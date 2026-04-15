/**
 * CoordX Pro — Content Script (v1.2.3)
 *
 * Supports:
 * - WorldGuessr (iframe URL detection)
 * - GeoGuessr (AGGRESSIVE network hooks + API monitoring)
 */

(function () {
  'use strict';

  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  console.log('[CoordX Pro] 🚀 Content script v1.2.3 loaded on:', window.location.href);

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

  let lastSentCoords = null;
  let lastIframeSrc = null;
  let geoGuessrToken = null; // Store game token from URL

  // For GeoGuessr, we need to be more lenient - accept coords from API calls
  function sendCoords(lat, lng, source, forceNew = false) {
    const isDifferent = !lastSentCoords || 
        Math.abs(lastSentCoords.lat - lat) > 0.0001 ||
        Math.abs(lastSentCoords.lng - lng) > 0.0001;

    if (!isDifferent && !forceNew) return;

    lastSentCoords = { lat, lng };
    console.log('[CoordX Pro] ✅ SENDING COORDS:', lat, lng, 'via', source);

    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat,
        lng,
        source
      }).catch(() => {});
    } catch (e) {}
  }

  // Force send new coords (for round changes)
  function forceSendCoords(lat, lng, source) {
    lastSentCoords = null; // Reset first
    sendCoords(lat, lng, source, true);
  }

  /* ─── GeoGuessr: Parse __NEXT_DATA__ (initial load only) ─── */

  function parseGeoGuessrNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script) return null;

    try {
      const data = JSON.parse(script.textContent);
      const props = data.props?.pageProps;

      if (!props?.gameSnapshot) return null;

      const snapshot = props.gameSnapshot;
      const rounds = snapshot.rounds;
      
      // Store token for API calls
      geoGuessrToken = snapshot.token;

      // Get ALL rounds and store them
      if (rounds && rounds.length > 0) {
        console.log('[CoordX Pro] GeoGuessr rounds loaded:', rounds.length);
        return rounds.map(r => ({ lat: r.lat, lng: r.lng }));
      }
    } catch (e) {
      console.warn('[CoordX Pro] Failed to parse __NEXT_DATA__:', e.message);
    }

    return null;
  }

  /* ─── WorldGuessr: Iframe URL Detection ────────────────── */

  function extractFromIframeSrc(src) {
    if (!src) return null;

    const locationMatch = src.match(/location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (locationMatch) {
      const lat = parseFloat(locationMatch[1]);
      const lng = parseFloat(locationMatch[2]);
      if (isValidCoord(lat, lng)) {
        return { lat, lng };
      }
    }
    return null;
  }

  function findStreetViewIframe() {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.src && (
        iframe.src.includes('google.com/maps') ||
        iframe.src.includes('streetview') ||
        iframe.src.includes('maps.googleapis.com') ||
        iframe.src.includes('location=')
      )) {
        return iframe;
      }
    }
    return null;
  }

  function checkIframe() {
    const iframe = findStreetViewIframe();
    if (iframe && iframe.src) {
      const srcChanged = lastIframeSrc !== iframe.src;
      if (srcChanged) {
        lastIframeSrc = iframe.src;
        const coords = extractFromIframeSrc(iframe.src);
        if (coords) {
          sendCoords(coords.lat, coords.lng, 'worldguessr_iframe');
          return true;
        }
      }
    }
    return false;
  }

  /* ─── Inject Page Script for Network Hooks ────────────── */

  function injectPageScript() {
    const script = document.createElement('script');
    script.id = 'coordx-page-script';

    script.textContent = `
(function() {
  if (window.__coordxPageInjected) return;
  window.__coordxPageInjected = true;

  console.log('[CoordX Pro] Page script v1.2.3 injected - AGGRESSIVE MODE');

  let lastSentTime = 0;
  const COOLDOWN = 2000; // 2 second cooldown for same coords

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source) {
    const now = Date.now();
    
    console.log('[CoordX Pro] 📍 Found coords:', lat, lng, 'via', source);
    
    window.dispatchEvent(new CustomEvent('__coordx_coords', {
      detail: { lat, lng, source, timestamp: now }
    }));
  }

  // Deep search for coordinates in any object
  function findAllCoords(obj, depth = 0, found = []) {
    if (depth > 20 || !obj) return found;

    if (Array.isArray(obj)) {
      // Check for [lat, lng] pair
      for (let i = 0; i < obj.length - 1; i++) {
        const lat = parseFloat(obj[i]);
        const lng = parseFloat(obj[i + 1]);
        if (isValidCoord(lat, lng)) {
          found.push({ lat, lng, source: 'array_pair' });
        }
      }
      for (const item of obj) {
        findAllCoords(item, depth + 1, found);
      }
    } else if (typeof obj === 'object' && obj !== null) {
      // Check for lat/lng keys
      const lat = obj.lat ?? obj.latitude ?? obj.y;
      const lng = obj.lng ?? obj.lon ?? obj.longitude ?? obj.x;
      
      if (typeof lat === 'number' && typeof lng === 'number' && isValidCoord(lat, lng)) {
        found.push({ lat, lng, source: 'object_keys' });
      }
      
      // Recurse into all values
      for (const v of Object.values(obj)) {
        findAllCoords(v, depth + 1, found);
      }
    }

    return found;
  }

  // Parse GeoGuessr specific responses
  function parseGeoGuessrData(data, url) {
    const results = [];
    
    // Check for game state with rounds
    if (data.gameSnapshot) {
      const snapshot = data.gameSnapshot;
      const currentRound = snapshot.round || 1;
      
      if (snapshot.rounds && snapshot.rounds[currentRound - 1]) {
        const r = snapshot.rounds[currentRound - 1];
        if (isValidCoord(r.lat, r.lng)) {
          results.push({ lat: r.lat, lng: r.lng, round: currentRound, source: 'gameSnapshot_round' });
        }
      }
      // Also check all rounds
      if (snapshot.rounds) {
        for (let i = 0; i < snapshot.rounds.length; i++) {
          const r = snapshot.rounds[i];
          if (isValidCoord(r.lat, r.lng)) {
            results.push({ lat: r.lat, lng: r.lng, round: i + 1, source: 'gameSnapshot_all' });
          }
        }
      }
    }
    
    // Direct rounds array
    if (data.rounds && Array.isArray(data.rounds)) {
      const round = data.round || data.currentRound || 1;
      for (let i = 0; i < data.rounds.length; i++) {
        const r = data.rounds[i];
        if (isValidCoord(r.lat, r.lng)) {
          results.push({ lat: r.lat, lng: r.lng, round: i + 1, source: 'rounds_array' });
        }
      }
    }
    
    // Single location
    if (isValidCoord(data.lat, data.lng)) {
      results.push({ lat: data.lat, lng: data.lng, source: 'single_location' });
    }

    return results;
  }

  function processResponse(text, url) {
    if (!text) return;
    
    try {
      const data = JSON.parse(text);
      
      // First try GeoGuessr specific parsing
      const ggResults = parseGeoGuessrData(data, url);
      for (const r of ggResults) {
        sendCoords(r.lat, r.lng, r.source + '_' + r.round);
      }
      
      // Then do deep search
      const found = findAllCoords(data);
      for (const r of found) {
        sendCoords(r.lat, r.lng, r.source);
      }
      
    } catch (e) {
      // Try regex for non-JSON responses
      const patterns = [
        /"lat"\\s*:\\s*(-?\\d{1,2}\\.\\d{4,})\\s*,\\s*"lng"\\s*:\\s*(-?\\d{1,3}\\.\\d{4,})/g,
        /"latitude"\\s*:\\s*(-?\\d{1,2}\\.\\d{4,})\\s*,\\s*"longitude"\\s*:\\s*(-?\\d{1,3}\\.\\d{4,})/g
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (isValidCoord(lat, lng)) {
            sendCoords(lat, lng, 'regex');
          }
        }
      }
    }
  }

  // Hook fetch - VERY AGGRESSIVE
  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await _fetch.apply(this, arguments);
    
    // Check ALL geoguessr.com API calls
    if (url.includes('geoguessr.com')) {
      console.log('[CoordX Pro] 🔍 GeoGuessr fetch:', url);
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        processResponse(text, url);
      } catch (e) {
        console.warn('[CoordX Pro] Fetch parse error:', e.message);
      }
    }
    
    return response;
  };

  // Hook XHR
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._coordx_url = url;
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    const xhr = this;
    xhr.addEventListener('load', function() {
      if (xhr._coordx_url && xhr._coordx_url.includes('geoguessr.com')) {
        console.log('[CoordX Pro] 🔍 GeoGuessr XHR:', xhr._coordx_url);
        processResponse(xhr.responseText, xhr._coordx_url);
      }
    });
    return _send.apply(this, arguments);
  };

  // Hook WebSocket for real-time updates
  const _WebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    const ws = new _WebSocket(url, protocols);
    
    if (url.includes('geoguessr')) {
      console.log('[CoordX Pro] 🔍 GeoGuessr WebSocket:', url);
      
      ws.addEventListener('message', (event) => {
        try {
          processResponse(event.data, 'websocket');
        } catch {}
      });
    }
    
    return ws;
  };
  window.WebSocket.prototype = _WebSocket.prototype;

  // Also monitor __NEXT_DATA__ attribute changes
  const script = document.getElementById('__NEXT_DATA__');
  if (script) {
    const observer = new MutationObserver(() => {
      console.log('[CoordX Pro] __NEXT_DATA__ changed');
      try {
        const data = JSON.parse(script.textContent);
        const results = parseGeoGuessrData(data, 'nextdata_mutation');
        for (const r of results) {
          sendCoords(r.lat, r.lng, r.source);
        }
      } catch {}
    });
    observer.observe(script, { childList: true, characterData: true, subtree: true });
  }

  console.log('[CoordX Pro] ✅ Aggressive network hooks installed');
})();
`;

    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  // Listen for coordinates from page script
  window.addEventListener('__coordx_coords', (event) => {
    const { lat, lng, source, timestamp } = event.detail;
    sendCoords(lat, lng, source);
  });

  /* ─── Initialization ──────────────────────────────────── */

  function init() {
    console.log('[CoordX Pro] Initializing v1.2.3...');
    injectPageScript();
    
    // Initial detection
    setTimeout(() => {
      const hostname = window.location.hostname;
      if (hostname.includes('geoguessr.com')) {
        parseGeoGuessrNextData();
      }
    }, 500);
  }

  // Setup observers
  function setupObservers() {
    const hostname = window.location.hostname;

    // WorldGuessr iframe monitoring
    if (hostname.includes('worldguessr.com')) {
      const observer = new MutationObserver(() => {
        checkIframe();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src']
      });

      // Also check periodically
      setInterval(checkIframe, 500);
    }

    // URL change detection (for SPAs)
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('[CoordX Pro] URL changed:', lastUrl);
        lastSentCoords = null; // Reset to allow new coords
      }
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      setupObservers();
    });
  } else {
    init();
    setupObservers();
  }

})();
