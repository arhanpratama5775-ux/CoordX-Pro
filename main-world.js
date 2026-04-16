/**
 * CoordX Pro — Main World Script (v1.8.26)
 * 
 * Intercept ALL requests to find WorldGuessr coordinates API
 * WorldGuessr doesn't use __NEXT_DATA__ for coords - they use API calls
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.26');

  function sendCoords(lat, lng, source) {
    window.postMessage({
      type: 'COORDX_COORDS',
      lat: lat,
      lng: lng,
      source: source
    }, '*');
  }

  function sendLog(msg) {
    window.postMessage({
      type: 'COORDX_LOG',
      message: msg
    }, '*');
  }

  function detectGame() {
    const host = window.location.hostname;
    if (host.includes('geoguessr')) return 'geoguessr';
    if (host.includes('worldguessr')) return 'worldguessr';
    if (host.includes('openguessr')) return 'openguessr';
    return 'unknown';
  }

  const game = detectGame();
  sendLog('Game: ' + game);

  // Track found coords to avoid duplicates
  let lastFoundCoords = null;

  // ─── SEARCH FOR COORDS IN RESPONSE ───────────────────────────

  function searchForCoords(text, source) {
    if (!text || text.length < 10) return;
    
    let found = false;
    
    // Pattern 1: [null,null,lat,lng]
    let matches = text.matchAll(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/g);
    for (const match of matches) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        const key = lat.toFixed(4) + ',' + lng.toFixed(4);
        if (key !== lastFoundCoords) {
          lastFoundCoords = key;
          sendLog('📍 [' + source + '] [null,null]: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
          sendCoords(lat, lng, source);
          found = true;
        }
      }
    }
    
    // Pattern 2: "lat":123.456,"lng":78.90
    matches = text.matchAll(/"lat"\s*:\s*(-?\d+\.\d+)\s*,\s*"lng"\s*:\s*(-?\d+\.\d+)/g);
    for (const match of matches) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        const key = lat.toFixed(4) + ',' + lng.toFixed(4);
        if (key !== lastFoundCoords) {
          lastFoundCoords = key;
          sendLog('📍 [' + source + '] lat/lng: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
          sendCoords(lat, lng, source);
          found = true;
        }
      }
    }
    
    // Pattern 3: "latitude":123.456,"longitude":78.90
    matches = text.matchAll(/"latitude"\s*:\s*(-?\d+\.\d+)\s*,\s*"longitude"\s*:\s*(-?\d+\.\d+)/g);
    for (const match of matches) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        const key = lat.toFixed(4) + ',' + lng.toFixed(4);
        if (key !== lastFoundCoords) {
          lastFoundCoords = key;
          sendLog('📍 [' + source + '] latitude/longitude: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
          sendCoords(lat, lng, source);
          found = true;
        }
      }
    }
    
    // Pattern 4: "location":{"lat":...,"lng":...}
    matches = text.matchAll(/"location"\s*:\s*\{[^}]*"lat"\s*:\s*(-?\d+\.\d+)[^}]*"lng"\s*:\s*(-?\d+\.\d+)[^}]*\}/g);
    for (const match of matches) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        const key = lat.toFixed(4) + ',' + lng.toFixed(4);
        if (key !== lastFoundCoords) {
          lastFoundCoords = key;
          sendLog('📍 [' + source + '] location object: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
          sendCoords(lat, lng, source);
          found = true;
        }
      }
    }
    
    return found;
  }

  // ─── INTERCEPT ALL XHR ───────────────────────────────────────

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    this._method = method;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    const url = this._url || '';
    const method = this._method || 'GET';
    
    // Log WorldGuessr requests
    if (game === 'worldguessr' && !url.includes('chrome-extension') && !url.includes('google-analytics') && !url.includes('googletagmanager')) {
      const endpoint = url.split('?')[0];
      sendLog('🔍 XHR: ' + method + ' ' + endpoint.substring(0, 80));
    }
    
    this.addEventListener('load', function() {
      try {
        const text = this.responseText;
        
        // GeoGuessr: Google Maps API
        if (url.includes('GetMetadata') || url.includes('SingleImageSearch')) {
          searchForCoords(text, 'xhr-geo');
        }
        
        // WorldGuessr: Search all responses
        if (game === 'worldguessr') {
          searchForCoords(text, 'xhr');
        }
      } catch (e) {}
    });
    
    return originalSend.apply(this, arguments);
  };

  // ─── INTERCEPT ALL FETCH ─────────────────────────────────────

  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input.url || '');
    const method = init?.method || 'GET';
    
    // Log WorldGuessr requests
    if (game === 'worldguessr' && !url.includes('chrome-extension') && !url.includes('google-analytics') && !url.includes('googletagmanager')) {
      const endpoint = url.split('?')[0];
      sendLog('🔍 Fetch: ' + method + ' ' + endpoint.substring(0, 80));
    }
    
    return originalFetch.apply(this, arguments).then(response => {
      const endpoint = url.split('?')[0];
      
      // Clone and search
      response.clone().text().then(text => {
        try {
          // GeoGuessr
          if (url.includes('GetMetadata') || url.includes('SingleImageSearch')) {
            searchForCoords(text, 'fetch-geo');
          }
          
          // WorldGuessr: Search all
          if (game === 'worldguessr') {
            searchForCoords(text, 'fetch');
          }
        } catch (e) {}
      });
      
      return response;
    });
  };

  // ─── ALSO CHECK WEBSOCKET ───────────────────────────────────

  const originalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    sendLog('🔌 WebSocket: ' + url);
    
    const ws = new originalWebSocket(url, protocols);
    
    ws.addEventListener('message', (event) => {
      try {
        const data = event.data;
        if (typeof data === 'string') {
          searchForCoords(data, 'ws');
        }
      } catch (e) {}
    });
    
    return ws;
  };

  // ─── CHECK LOCALSTORAGE/SESSIONSTORAGE ──────────────────────

  function checkStorage() {
    if (game !== 'worldguessr') return;
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        if (val && (val.includes('lat') || val.includes('lng') || val.includes('coordinate'))) {
          sendLog('💾 localStorage[' + key + '] has coords data');
          searchForCoords(val, 'storage');
        }
      }
    } catch (e) {}
  }

  setTimeout(checkStorage, 2000);

  // ─── WATCH URL FOR GAME CHANGES ──────────────────────────────

  let lastUrl = window.location.href;
  
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      lastFoundCoords = null;
      sendLog('🔄 URL changed: ' + window.location.href);
      checkStorage();
    }
  }, 500);

  sendLog('v1.8.26 ready - intercepting ALL requests');

})();
