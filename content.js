/**
 * CoordX Pro — Content Script (v1.0.4)
 *
 * Injects a page script to intercept fetch/XHR/WebSocket responses at the page level.
 * This is necessary because Chrome MV3 service workers cannot access response bodies.
 */

(function () {
  'use strict';

  // Don't inject twice
  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  console.log('[CoordX Pro] Content script loaded on:', window.location.href);

  /**
   * Inject a script tag into the page to hook into fetch/XHR/WebSocket.
   * MUST append to DOM first, then remove (the script will have executed).
   */
  function injectPageScript() {
    // Check if already injected
    if (window.__coordxPageInjected) return;

    const script = document.createElement('script');
    script.id = 'coordx-page-script';

    script.textContent = `
(function() {
  // Don't inject twice
  if (window.__coordxPageInjected) return;
  window.__coordxPageInjected = true;

  console.log('[CoordX Pro] Page script injected successfully!');

  // Track found coordinates to avoid duplicates
  let lastFoundCoords = null;

  // Comprehensive patterns for GeoGuessr and similar games
  const GEO_PATTERNS = [
    /GeoPhotoService/i,
    /streetviewpixels/i,
    /cbk[0-9]*\\.google/i,
    /geo[0-9]*\\.ggpht/i,
    /lh[3-6]\\.ggpht/i,
    /maps\\.googleapis\\.com.*streetview/i,
    /maps\\.googleapis\\.com.*photo/i,
    /maps\\.googleapis\\.com.*pano/i,
    /googleusercontent\\.com.*streetview/i,
    /google\\.com.*cbk/i,
    /google\\.com.*geo/i,
    /panorama/i,
    /pano_id/i,
    /svv/i,
    /street_view/i,
    /streetview/i,
    /photometa/i,
    /photodebug/i,
    /maps\\.google/i,
    /google.*maps/i,
    /earth/i,
    /staticmap/i,
  ];

  function isGeoUrl(url) {
    if (!url) return false;
    const urlStr = url.toString().toLowerCase();
    return GEO_PATTERNS.some(pattern => pattern.test(urlStr));
  }

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
    // Avoid duplicates
    if (lastFoundCoords && 
        Math.abs(lastFoundCoords.lat - lat) < 0.0001 &&
        Math.abs(lastFoundCoords.lng - lng) < 0.0001) {
      return;
    }
    lastFoundCoords = { lat, lng };

    console.log('[CoordX Pro] ✅ Found coords:', lat, lng, 'from', source);
    
    window.dispatchEvent(new CustomEvent('__coordx_coords', {
      detail: { lat, lng, source }
    }));
  }

  function parseCoordinates(data, url) {
    if (!data) return null;

    const text = typeof data === 'string' ? data : JSON.stringify(data);

    // Strategy 1: Extract from URL parameters
    try {
      const urlObj = new URL(url, window.location.origin);
      const lat = parseFloat(urlObj.searchParams.get('lat') || urlObj.searchParams.get('y'));
      const lng = parseFloat(urlObj.searchParams.get('lng') || urlObj.searchParams.get('lon') || urlObj.searchParams.get('x'));
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'url_param' };
      }
    } catch (e) {}

    // Strategy 2: Parse as JSON (various formats)
    try {
      let parsed;
      const trimmed = text.trim();

      // Handle Google's )]}' prefix
      if (trimmed.startsWith(')]}')) {
        const jsonPart = trimmed.substring(trimmed.indexOf('\\n') + 1);
        try {
          parsed = JSON.parse(jsonPart);
        } catch (e) {
          const arrayMatch = jsonPart.match(/\\[[\\s\\S]*\\]/);
          if (arrayMatch) {
            parsed = JSON.parse(arrayMatch[0]);
          }
        }
      } else {
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          const arrayMatch = trimmed.match(/\\[[\\s\\S]*\\]/);
          if (arrayMatch) {
            parsed = JSON.parse(arrayMatch[0]);
          }
        }
      }

      if (parsed) {
        const result = findCoordsInData(parsed);
        if (result) {
          return { ...result, source: 'json_parse' };
        }
      }
    } catch (e) {}

    // Strategy 3: Regex patterns in text
    const bracketPairs = text.match(/\\[\\s*(-?\\d{1,2}\\.\\d{4,})\\s*,\\s*(-?\\d{1,3}\\.\\d{4,})\\s*\\]/g);
    if (bracketPairs) {
      for (const pair of bracketPairs) {
        const nums = pair.match(/-?\\d+\\.\\d+/g);
        if (nums && nums.length >= 2) {
          const lat = parseFloat(nums[0]);
          const lng = parseFloat(nums[1]);
          if (isValidCoord(lat, lng)) {
            return { lat, lng, source: 'bracket_regex' };
          }
        }
      }
    }

    // Pattern: "lat":number,"lng":number or similar
    const latLngPattern = /["']?(?:lat|latitude|y)["']?\\s*[:=]\\s*(-?\\d{1,2}\\.\\d{4,})[^\\d]*["']?(?:lng|lon|longitude|x)["']?\\s*[:=]\\s*(-?\\d{1,3}\\.\\d{4,})/i;
    let match = text.match(latLngPattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'key_value' };
      }
    }

    // Pattern: Any two consecutive numbers that look like coordinates
    const allNumPattern = /(-?\\d{1,2}\\.\\d{4,15})/g;
    const allNums = [];
    let numMatch;
    while ((numMatch = allNumPattern.exec(text)) !== null) {
      allNums.push(parseFloat(numMatch[1]));
    }

    // Look for coordinate-like pairs
    for (let i = 0; i < allNums.length - 1; i++) {
      const lat = allNums[i];
      const lng = allNums[i + 1];
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'sequential_nums' };
      }
    }

    return null;
  }

  function findCoordsInData(data, depth = 0) {
    if (depth > 10 || !data) return null;

    // Array handling
    if (Array.isArray(data)) {
      // Try [lat, lng] at positions 0,1
      if (data.length >= 2 && typeof data[0] === 'number' && typeof data[1] === 'number') {
        const lat = parseFloat(data[0]);
        const lng = parseFloat(data[1]);
        if (isValidCoord(lat, lng)) {
          return { lat, lng };
        }
      }

      // Try [?, ?, lat, lng] at positions 2,3 (Google's format)
      if (data.length >= 4 && typeof data[2] === 'number' && typeof data[3] === 'number') {
        const lat = parseFloat(data[2]);
        const lng = parseFloat(data[3]);
        if (isValidCoord(lat, lng)) {
          return { lat, lng };
        }
      }

      // Try nested arrays
      for (const item of data) {
        if (Array.isArray(item) || (typeof item === 'object' && item !== null)) {
          const result = findCoordsInData(item, depth + 1);
          if (result) return result;
        }
      }
    }

    // Object handling
    if (typeof data === 'object' && data !== null) {
      // Look for lat/lng keys
      const lat = data.lat ?? data.latitude ?? data.y ?? data._lat;
      const lng = data.lng ?? data.lon ?? data.longitude ?? data.x ?? data._lng;

      if (typeof lat === 'number' && typeof lng === 'number' && isValidCoord(lat, lng)) {
        return { lat, lng };
      }

      // Check nested objects
      for (const key of Object.keys(data)) {
        const result = findCoordsInData(data[key], depth + 1);
        if (result) return result;
      }
    }

    return null;
  }

  async function processResponse(url, response) {
    try {
      const cloned = response.clone();
      const text = await cloned.text();

      if (text && text.length > 0) {
        const coords = parseCoordinates(text, url);
        if (coords) {
          sendCoords(coords.lat, coords.lng, coords.source);
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  /* ─── Hook Fetch ─────────────────────────────────────── */
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    let url = null;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
    } else if (input?.url) {
      url = input.url;
    }

    const response = await originalFetch.apply(this, arguments);

    // Process all responses
    if (url) {
      const isGeo = isGeoUrl(url);
      if (isGeo) {
        console.log('[CoordX Pro] 🔍 Intercepted geo fetch:', url.substring(0, 100));
        processResponse(url, response).catch(() => {});
      }
    }

    return response;
  };

  /* ─── Hook XMLHttpRequest ─────────────────────────────── */
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this.__coordx_url = url;
    this.__coordx_method = method;
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    const xhr = this;

    xhr.addEventListener('load', function() {
      if (xhr.__coordx_url) {
        const isGeo = isGeoUrl(xhr.__coordx_url);
        if (isGeo) {
          console.log('[CoordX Pro] 🔍 Intercepted geo XHR:', xhr.__coordx_url.substring(0, 100));
          try {
            const coords = parseCoordinates(xhr.responseText, xhr.__coordx_url);
            if (coords) {
              sendCoords(coords.lat, coords.lng, coords.source);
            }
          } catch (e) {}
        }
      }
    });

    return originalXHRSend.apply(this, arguments);
  };

  /* ─── Hook WebSocket for real-time data ───────────────── */
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    const ws = new OriginalWebSocket(url, protocols);

    ws.addEventListener('message', function(event) {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          const coords = parseCoordinates(data, url);
          if (coords) {
            console.log('[CoordX Pro] 🔍 Found coords via WebSocket');
            sendCoords(coords.lat, coords.lng, 'websocket');
          }
        }
      } catch (e) {}
    });

    return ws;
  };
  window.WebSocket.prototype = OriginalWebSocket.prototype;

  console.log('[CoordX Pro] ✅ All hooks installed (fetch, XHR, WebSocket)');
})();
`;

    // CRITICAL: Must append to DOM first, then remove
    (document.head || document.documentElement).appendChild(script);
    script.remove();
    
    console.log('[CoordX Pro] Page script injection complete');
  }

  // Inject immediately - document_start runs before DOM is ready
  if (document.documentElement) {
    injectPageScript();
  }

  // Also try on DOMContentLoaded as backup
  document.addEventListener('DOMContentLoaded', injectPageScript);

  /**
   * Listen for coordinates from the page script
   */
  window.addEventListener('__coordx_coords', (event) => {
    const { lat, lng, source } = event.detail;

    console.log(`[CoordX Pro] 📍 Content script received coords:`, lat, lng, 'via', source);

    // Send to background script
    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat,
        lng,
        source
      }).then(response => {
        console.log('[CoordX Pro] Background response:', response);
      }).catch(err => {
        console.warn('[CoordX Pro] Could not send to background:', err.message);
      });
    } catch (e) {
      console.error('[CoordX Pro] sendMessage failed:', e);
    }
  });

})();
