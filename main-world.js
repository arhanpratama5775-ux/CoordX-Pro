/**
 * CoordX Pro — Main World Script (v1.8.24)
 * 
 * Aggressive coordinate hunting:
 * - Log ALL requests to find WorldGuessr API
 * - Search window object for coordinates
 * - Multiple detection methods
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.24');

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
  let loggedEndpoints = new Set();

  // ─── INTERCEPT ALL XHR - Log everything for WorldGuessr ─────────────

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
    
    this.addEventListener('load', function() {
      // GeoGuessr: Google Maps API
      if (url.includes('GetMetadata') || url.includes('SingleImageSearch')) {
        try {
          const match = this.responseText.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
          if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              sendLog('📍 XHR GeoGuessr: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
              sendCoords(lat, lng, 'xhr');
            }
          }
        } catch (e) {}
      }
      
      // WorldGuessr: Log ALL requests to find the API
      if (game === 'worldguessr') {
        // Log endpoints we haven't seen
        const endpoint = url.split('?')[0].split('/').slice(-2).join('/');
        if (!loggedEndpoints.has(endpoint) && !url.includes('chrome-extension')) {
          loggedEndpoints.add(endpoint);
          sendLog('🔍 XHR: ' + method + ' ' + endpoint);
        }
        
        // Try to find coordinates in any response
        try {
          const text = this.responseText;
          
          // Pattern 1: [null,null,lat,lng]
          let match = text.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
          if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              sendLog('📍 Found [null,null,lat,lng] in ' + endpoint);
              sendCoords(lat, lng, 'xhr');
            }
          }
          
          // Pattern 2: "lat":123.456,"lng":78.90
          match = text.match(/"lat"\s*:\s*(-?\d+\.\d+)\s*,\s*"lng"\s*:\s*(-?\d+\.\d+)/);
          if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              sendLog('📍 Found "lat","lng" in ' + endpoint);
              sendCoords(lat, lng, 'xhr');
            }
          }
          
          // Pattern 3: "latitude":123.456,"longitude":78.90
          match = text.match(/"latitude"\s*:\s*(-?\d+\.\d+)\s*,\s*"longitude"\s*:\s*(-?\d+\.\d+)/);
          if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              sendLog('📍 Found "latitude","longitude" in ' + endpoint);
              sendCoords(lat, lng, 'xhr');
            }
          }
          
          // Pattern 4: coordinates array [lat, lng]
          match = text.match(/"coordinates"\s*:\s*\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/);
          if (match) {
            const lng = parseFloat(match[1]); // GeoJSON format is [lng, lat]
            const lat = parseFloat(match[2]);
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              sendLog('📍 Found coordinates[] in ' + endpoint);
              sendCoords(lat, lng, 'xhr');
            }
          }
          
        } catch (e) {}
      }
    });
    
    return originalSend.apply(this, arguments);
  };

  // ─── INTERCEPT ALL FETCH ───────────────────────────────────

  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input.url || '');
    const method = init?.method || 'GET';
    
    return originalFetch.apply(this, arguments).then(response => {
      // GeoGuessr: Google Maps API
      if (url.includes('GetMetadata') || url.includes('SingleImageSearch')) {
        const clonedResponse = response.clone();
        clonedResponse.text().then(text => {
          try {
            const match = text.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
            if (match) {
              const lat = parseFloat(match[1]);
              const lng = parseFloat(match[2]);
              if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                sendLog('📍 Fetch GeoGuessr: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
                sendCoords(lat, lng, 'fetch');
              }
            }
          } catch (e) {}
        });
      }
      
      // WorldGuessr: Log and search ALL responses
      if (game === 'worldguessr') {
        const endpoint = url.split('?')[0].split('/').slice(-2).join('/');
        if (!loggedEndpoints.has(endpoint) && !url.includes('chrome-extension')) {
          loggedEndpoints.add(endpoint);
          sendLog('🔍 Fetch: ' + method + ' ' + endpoint);
        }
        
        const clonedResponse = response.clone();
        clonedResponse.text().then(text => {
          try {
            // Try all patterns
            let match = text.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
            if (match) {
              const lat = parseFloat(match[1]);
              const lng = parseFloat(match[2]);
              if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                sendLog('📍 Fetch found coords in ' + endpoint);
                sendCoords(lat, lng, 'fetch');
              }
            }
            
            match = text.match(/"lat"\s*:\s*(-?\d+\.\d+)\s*,\s*"lng"\s*:\s*(-?\d+\.\d+)/);
            if (match) {
              const lat = parseFloat(match[1]);
              const lng = parseFloat(match[2]);
              if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                sendLog('📍 Fetch found lat/lng in ' + endpoint);
                sendCoords(lat, lng, 'fetch');
              }
            }
            
            match = text.match(/"latitude"\s*:\s*(-?\d+\.\d+)\s*,\s*"longitude"\s*:\s*(-?\d+\.\d+)/);
            if (match) {
              const lat = parseFloat(match[1]);
              const lng = parseFloat(match[2]);
              if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                sendLog('📍 Fetch found lat/lng in ' + endpoint);
                sendCoords(lat, lng, 'fetch');
              }
            }
          } catch (e) {}
        });
      }
      
      return response;
    });
  };

  // ─── SEARCH WINDOW OBJECT FOR COORDINATES ──────────────────

  function searchWindowObject() {
    if (game !== 'worldguessr') return;
    
    sendLog('🔍 Searching window object...');
    
    // Common property names to check
    const checkProps = [
      '__NEXT_DATA__',
      '__NUXT__',
      '__INITIAL_STATE__',
      '__STATE__',
      'INITIAL_DATA',
      'window.__data',
      '__PRELOADED_STATE__'
    ];
    
    for (const prop of checkProps) {
      try {
        const val = window[prop];
        if (val) {
          sendLog('🔍 Found window.' + prop);
        }
      } catch (e) {}
    }
    
    // Search for objects with lat/lng
    function findCoordsInObject(obj, path = '', depth = 0) {
      if (depth > 4 || !obj || typeof obj !== 'object') return;
      
      try {
        // Check this object
        if (typeof obj.lat === 'number' && typeof obj.lng === 'number') {
          if (obj.lat >= -90 && obj.lat <= 90 && obj.lng >= -180 && obj.lng <= 180) {
            sendLog('📍 Found at window.' + path);
            sendCoords(obj.lat, obj.lng, 'window');
            return;
          }
        }
        
        // Search children
        for (const key in obj) {
          if (key.startsWith('_') || key === 'window') continue;
          findCoordsInObject(obj[key], path ? path + '.' + key : key, depth + 1);
        }
      } catch (e) {}
    }
    
    // Check Next.js internal
    if (window.__NEXT_DATA__) {
      sendLog('🔍 __NEXT_DATA__ type: ' + typeof window.__NEXT_DATA__);
      findCoordsInObject(window.__NEXT_DATA__, '__NEXT_DATA__');
    }
    
    // Check React Fiber
    const root = document.getElementById('__next');
    if (root && root._reactRootContainer) {
      sendLog('🔍 Found React root');
    }
  }

  // Run search after page loads
  setTimeout(searchWindowObject, 1000);
  setTimeout(searchWindowObject, 3000);

  // ─── POLL FOR WINDOW OBJECT CHANGES ─────────────────────────

  let lastWindowCoords = null;
  
  setInterval(() => {
    if (game !== 'worldguessr') return;
    
    // Try __NEXT_DATA__ again
    try {
      const nextData = window.__NEXT_DATA__;
      if (nextData?.props?.pageProps) {
        const pp = nextData.props.pageProps;
        
        // Check various paths
        const paths = [
          pp.rounds?.[pp.rounds.length - 1],
          pp.game?.rounds?.[pp.game.rounds.length - 1],
          pp.currentRound,
          pp.location,
          pp.streetView
        ];
        
        for (const p of paths) {
          if (p && typeof p.lat === 'number' && typeof p.lng === 'number') {
            const coordStr = p.lat.toFixed(4) + ',' + p.lng.toFixed(4);
            if (coordStr !== lastWindowCoords) {
              lastWindowCoords = coordStr;
              sendLog('📍 __NEXT_DATA__ poll: ' + coordStr);
              sendCoords(p.lat, p.lng, 'poll');
            }
          }
        }
      }
    } catch (e) {}
  }, 1000);

  sendLog('Main world v1.8.24 ready - Aggressive mode for ' + game);

})();
