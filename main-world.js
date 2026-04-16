/**
 * CoordX Pro — Main World Script (v1.8.25)
 * 
 * Debug WorldGuessr __NEXT_DATA__ structure
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.25');

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

  // ─── DEEP LOG __NEXT_DATA__ FOR WORLDGUESSR ────────────────

  function logNextDataStructure() {
    if (game !== 'worldguessr') return;
    
    try {
      const nd = window.__NEXT_DATA__;
      if (!nd) {
        sendLog('❌ No __NEXT_DATA__');
        return;
      }

      sendLog('=== __NEXT_DATA__ STRUCTURE ===');
      
      // Log top level keys
      sendLog('Top keys: ' + Object.keys(nd).join(', '));
      
      // Check props
      if (nd.props) {
        sendLog('props keys: ' + Object.keys(nd.props).join(', '));
        
        // Check pageProps
        if (nd.props.pageProps) {
          const pp = nd.props.pageProps;
          sendLog('pageProps keys: ' + Object.keys(pp).join(', '));
          
          // Log each key's type and sample
          for (const key of Object.keys(pp)) {
            const val = pp[key];
            const type = typeof val;
            
            if (type === 'object' && val !== null) {
              if (Array.isArray(val)) {
                sendLog('  ' + key + ': array[' + val.length + ']');
                if (val.length > 0) {
                  sendLog('    [0] keys: ' + Object.keys(val[0]).join(', '));
                }
              } else {
                sendLog('  ' + key + ': object with keys: ' + Object.keys(val).slice(0,10).join(', '));
              }
            } else {
              sendLog('  ' + key + ': ' + type);
            }
          }
        } else {
          sendLog('No pageProps');
        }
      } else {
        sendLog('No props');
      }
      
      // Also search for coordinates
      findCoordsInObject(nd, '__NEXT_DATA__', 0);
      
    } catch (e) {
      sendLog('Error: ' + e.message);
    }
  }

  function findCoordsInObject(obj, path, depth) {
    if (depth > 6 || !obj || typeof obj !== 'object') return;
    
    try {
      // Check if this object has lat/lng
      if (typeof obj.lat === 'number' && typeof obj.lng === 'number') {
        if (obj.lat >= -90 && obj.lat <= 90 && obj.lng >= -180 && obj.lng <= 180) {
          sendLog('📍 FOUND at ' + path + ': ' + obj.lat.toFixed(4) + ', ' + obj.lng.toFixed(4));
          sendCoords(obj.lat, obj.lng, 'nextdata');
          return true;
        }
      }
      
      // Also check latitude/longitude
      if (typeof obj.latitude === 'number' && typeof obj.longitude === 'number') {
        if (obj.latitude >= -90 && obj.latitude <= 90 && obj.longitude >= -180 && obj.longitude <= 180) {
          sendLog('📍 FOUND at ' + path + ': ' + obj.latitude.toFixed(4) + ', ' + obj.longitude.toFixed(4));
          sendCoords(obj.latitude, obj.longitude, 'nextdata');
          return true;
        }
      }
      
      // Search children
      for (const key in obj) {
        if (key.startsWith('_') || key === 'window') continue;
        const childPath = path + '.' + key;
        if (findCoordsInObject(obj[key], childPath, depth + 1)) {
          return true;
        }
      }
    } catch (e) {}
    
    return false;
  }

  // Run immediately and after delays
  setTimeout(logNextDataStructure, 500);
  setTimeout(logNextDataStructure, 2000);
  setTimeout(logNextDataStructure, 5000);

  // ─── GEOGUESSR XHR INTERCEPT ─────────────────────────────────

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    this._method = method;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    const url = this._url || '';
    
    this.addEventListener('load', function() {
      if (url.includes('GetMetadata') || url.includes('SingleImageSearch')) {
        try {
          const match = this.responseText.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
          if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              sendLog('📍 GeoGuessr XHR: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
              sendCoords(lat, lng, 'xhr');
            }
          }
        } catch (e) {}
      }
    });
    
    return originalSend.apply(this, arguments);
  };

  // Fetch intercept for GeoGuessr
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input.url || '');
    
    return originalFetch.apply(this, arguments).then(response => {
      if (url.includes('GetMetadata') || url.includes('SingleImageSearch')) {
        const clonedResponse = response.clone();
        clonedResponse.text().then(text => {
          try {
            const match = text.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
            if (match) {
              const lat = parseFloat(match[1]);
              const lng = parseFloat(match[2]);
              if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                sendLog('📍 GeoGuessr Fetch: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
                sendCoords(lat, lng, 'fetch');
              }
            }
          } catch (e) {}
        });
      }
      return response;
    });
  };

  // ─── POLL FOR URL CHANGES ─────────────────────────────────

  let lastUrl = window.location.href;
  let lastCoordString = null;

  setInterval(() => {
    // Check URL change
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      lastCoordString = null;
      sendLog('URL changed, re-checking');
      setTimeout(logNextDataStructure, 500);
    }
    
    // Poll for coords
    try {
      const nd = window.__NEXT_DATA__;
      if (nd && findCoordsInObject(nd, '__NEXT_DATA__', 0)) {
        // Found coords
      }
    } catch (e) {}
  }, 1000);

  sendLog('Main world v1.8.25 ready');

})();
