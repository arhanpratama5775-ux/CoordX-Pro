/**
 * CoordX Pro — Content Script (v1.0.5)
 *
 * More aggressive interception - logs ALL requests for debugging
 * and tries multiple methods to find coordinates.
 */

(function () {
  'use strict';

  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  console.log('[CoordX Pro] 🚀 Content script loaded on:', window.location.href);

  function injectPageScript() {
    if (window.__coordxPageInjected) return;

    const script = document.createElement('script');
    script.id = 'coordx-page-script';

    script.textContent = `
(function() {
  if (window.__coordxPageInjected) return;
  window.__coordxPageInjected = true;

  console.log('[CoordX Pro] 🚀 Page script injected!');

  let lastFoundCoords = null;
  let requestCount = 0;

  function isValidCoord(lat, lng) {
    return (
      !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 &&
      Math.abs(lng) > 0.001
    );
  }

  function sendCoords(lat, lng, source) {
    if (lastFoundCoords && 
        Math.abs(lastFoundCoords.lat - lat) < 0.0001 &&
        Math.abs(lastFoundCoords.lng - lng) < 0.0001) {
      return;
    }
    lastFoundCoords = { lat, lng };

    console.log('[CoordX Pro] ✅✅✅ FOUND COORDINATES:', lat, lng, 'via', source);
    
    window.dispatchEvent(new CustomEvent('__coordx_coords', {
      detail: { lat, lng, source }
    }));
  }

  function extractCoordsFromText(text, source) {
    if (!text || typeof text !== 'string') return null;

    // Log first 200 chars for debugging
    console.log('[CoordX Pro] 📄 Analyzing response:', text.substring(0, 200));

    // Pattern 1: [number, number] - array format
    const arrays = text.match(/\\[\\s*(-?\\d{1,2}\\.\\d{3,})\\s*,\\s*(-?\\d{1,3}\\.\\d{3,})\\s*\\]/g);
    if (arrays) {
      for (const arr of arrays) {
        const nums = arr.match(/-?\\d+\\.\\d+/g);
        if (nums && nums.length >= 2) {
          const lat = parseFloat(nums[0]);
          const lng = parseFloat(nums[1]);
          if (isValidCoord(lat, lng)) {
            return { lat, lng };
          }
        }
      }
    }

    // Pattern 2: lat/lng keys
    const latKeyMatch = text.match(/"(?:lat|latitude|y)"\\s*:\\s*(-?\\d{1,2}\\.\\d+)/i);
    const lngKeyMatch = text.match(/"(?:lng|lon|longitude|x)"\\s*:\\s*(-?\\d{1,3}\\.\\d+)/i);
    if (latKeyMatch && lngKeyMatch) {
      const lat = parseFloat(latKeyMatch[1]);
      const lng = parseFloat(lngKeyMatch[1]);
      if (isValidCoord(lat, lng)) {
        return { lat, lng };
      }
    }

    // Pattern 3: Any pair of decimal numbers that look like coords
    const allDecimals = text.match(/-?\\d{1,2}\\.\\d{4,15}/g);
    if (allDecimals && allDecimals.length >= 2) {
      for (let i = 0; i < allDecimals.length - 1; i++) {
        const lat = parseFloat(allDecimals[i]);
        const lng = parseFloat(allDecimals[i + 1]);
        if (isValidCoord(lat, lng)) {
          return { lat, lng };
        }
      }
    }

    return null;
  }

  function findCoordsInObject(obj, depth = 0) {
    if (depth > 15 || !obj) return null;

    if (Array.isArray(obj)) {
      // Check [lat, lng] at start
      if (obj.length >= 2 && typeof obj[0] === 'number' && typeof obj[1] === 'number') {
        const lat = obj[0], lng = obj[1];
        if (isValidCoord(lat, lng)) return { lat, lng };
      }
      // Check [?, ?, lat, lng] 
      if (obj.length >= 4 && typeof obj[2] === 'number' && typeof obj[3] === 'number') {
        const lat = obj[2], lng = obj[3];
        if (isValidCoord(lat, lng)) return { lat, lng };
      }
      // Recurse
      for (const item of obj) {
        const result = findCoordsInObject(item, depth + 1);
        if (result) return result;
      }
    }

    if (typeof obj === 'object' && obj !== null) {
      // Look for lat/lng keys
      const lat = obj.lat ?? obj.latitude ?? obj.y ?? obj._lat ?? obj.location?.lat;
      const lng = obj.lng ?? obj.lon ?? obj.longitude ?? obj.x ?? obj.location?.lng;
      if (typeof lat === 'number' && typeof lng === 'number' && isValidCoord(lat, lng)) {
        return { lat, lng };
      }
      // Recurse
      for (const key of Object.keys(obj)) {
        const result = findCoordsInObject(obj[key], depth + 1);
        if (result) return result;
      }
    }

    return null;
  }

  function parseAllFormats(data, url) {
    // Try JSON parse
    try {
      let parsed;
      const text = typeof data === 'string' ? data.trim() : '';
      
      // Handle Google's )]}' prefix
      if (text.startsWith(')]}')) {
        const jsonPart = text.substring(text.indexOf('\\n') + 1);
        try { parsed = JSON.parse(jsonPart); } catch {}
      } else if (text.startsWith('[') || text.startsWith('{')) {
        try { parsed = JSON.parse(text); } catch {}
      }

      if (parsed) {
        const result = findCoordsInObject(parsed);
        if (result) return result;
      }
    } catch {}

    // Try regex
    const textResult = extractCoordsFromText(typeof data === 'string' ? data : JSON.stringify(data));
    if (textResult) return textResult;

    return null;
  }

  async function processRequest(url, response) {
    requestCount++;
    
    // Log ALL requests for debugging (first 80 chars)
    console.log('[CoordX Pro] #' + requestCount + ' 🌐', url.substring(0, 80));

    try {
      const cloned = response.clone();
      const text = await cloned.text();

      if (!text) return;

      const coords = parseAllFormats(text, url);
      if (coords) {
        sendCoords(coords.lat, coords.lng, 'fetch:' + url.substring(0, 50));
      }
    } catch (e) {}
  }

  /* ─── Hook Fetch ─────────────────────────────────────── */
  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await _fetch.apply(this, arguments);
    processRequest(url, response).catch(() => {});
    return response;
  };

  /* ─── Hook XMLHttpRequest ─────────────────────────────── */
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return _open.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    const xhr = this;
    xhr.addEventListener('load', function() {
      requestCount++;
      console.log('[CoordX Pro] #' + requestCount + ' 🌐 XHR:', (xhr._url || '').substring(0, 80));
      
      if (xhr.responseText) {
        const coords = parseAllFormats(xhr.responseText, xhr._url);
        if (coords) {
          sendCoords(coords.lat, coords.lng, 'xhr');
        }
      }
    });
    return _send.apply(this, arguments);
  };

  /* ─── Hook WebSocket ───────────────────────────────────── */
  const _WS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    const ws = new _WS(url, protocols);
    ws.addEventListener('message', function(e) {
      if (typeof e.data === 'string' && e.data.length > 10) {
        requestCount++;
        console.log('[CoordX Pro] #' + requestCount + ' 🌐 WS message:', e.data.substring(0, 80));
        const coords = parseAllFormats(e.data, url);
        if (coords) {
          sendCoords(coords.lat, coords.lng, 'websocket');
        }
      }
    });
    return ws;
  };
  window.WebSocket.prototype = _WS.prototype;

  /* ─── Try to access Google Maps/Street View directly ─── */
  function tryExtractFromWindow() {
    // Try various possible locations for Street View data
    const checks = [
      () => window.google?.maps?.StreetViewPanorama?.getLocation?.()?.latLng?.lat && 
            window.google?.maps?.StreetViewPanorama?.getLocation?.()?.latLng?.lng,
      () => window.panorama?.getPosition?.()?.lat?.() && window.panorama?.getPosition?.()?.lng?.(),
      () => window.sv?.getLocation?.()?.latLng?.lat && window.sv?.getLocation?.()?.latLng?.lng,
      () => window.streetView?.getLocation?.()?.latLng,
      () => window.__INITIAL_STATE__?.location,
      () => window.__NEXT_DATA__?.props?.pageProps?.location,
      () => window.gameState?.location,
      () => window.__GAME_STATE__?.location,
    ];

    for (const check of checks) {
      try {
        const result = check();
        if (result) {
          let lat, lng;
          if (typeof result.lat === 'function') {
            lat = result.lat();
            lng = result.lng();
          } else if (result.lat !== undefined) {
            lat = result.lat;
            lng = result.lng;
          } else if (typeof result === 'object') {
            lat = result.latitude || result.lat;
            lng = result.longitude || result.lng;
          }
          if (isValidCoord(lat, lng)) {
            return { lat, lng };
          }
        }
      } catch {}
    }
    return null;
  }

  // Poll for window data every 2 seconds
  setInterval(() => {
    const coords = tryExtractFromWindow();
    if (coords) {
      sendCoords(coords.lat, coords.lng, 'window_object');
    }
  }, 2000);

  console.log('[CoordX Pro] ✅ All hooks installed - watching ALL requests');
  console.log('[CoordX Pro] 💡 Start a game and check console for intercepted requests');
})();
`;

    (document.head || document.documentElement).appendChild(script);
    script.remove();
    console.log('[CoordX Pro] Page script injected');
  }

  // Inject immediately
  if (document.documentElement) {
    injectPageScript();
  }
  document.addEventListener('DOMContentLoaded', injectPageScript);

  // Listen for coords
  window.addEventListener('__coordx_coords', (event) => {
    const { lat, lng, source } = event.detail;
    console.log(`[CoordX Pro] 📍 Content script received:`, lat, lng, 'via', source);

    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat,
        lng,
        source
      }).catch(() => {});
    } catch {}
  });

})();
