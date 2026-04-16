/**
 * CoordX Pro — Main World Script (v1.8.22)
 * 
 * Dual approach:
 * - GeoGuessr: XHR intercept Google Maps API
 * - WorldGuessr: Parse __NEXT_DATA__
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.22');

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

  // ─── WorldGuessr: Parse __NEXT_DATA__ ─────────────────────────

  function extractWorldGuessrCoords() {
    try {
      const scriptTag = document.getElementById('__NEXT_DATA__');
      if (!scriptTag) return null;

      const data = JSON.parse(scriptTag.textContent);
      
      // Try different paths for coordinates
      let lat = null;
      let lng = null;

      // Path 1: rounds array
      if (data?.props?.pageProps?.game?.rounds) {
        const rounds = data.props.pageProps.game.rounds;
        if (rounds.length > 0) {
          // Get the latest round
          const round = rounds[rounds.length - 1];
          lat = round.lat || round.latitude;
          lng = round.lng || round.lng || round.longitude;
        }
      }

      // Path 2: currentRound
      if (!lat && data?.props?.pageProps?.game?.currentRound) {
        const round = data.props.pageProps.game.currentRound;
        lat = round.lat || round.latitude;
        lng = round.lng || round.longitude;
      }

      // Path 3: location object
      if (!lat && data?.props?.pageProps?.location) {
        const loc = data.props.pageProps.location;
        lat = loc.lat || loc.latitude;
        lng = loc.lng || loc.lng || loc.longitude;
      }

      // Path 4: streetView object
      if (!lat && data?.props?.pageProps?.streetView) {
        const sv = data.props.pageProps.streetView;
        lat = sv.lat || sv.latitude;
        lng = sv.lng || sv.lng || sv.longitude;
      }

      // Path 5: Deep search in pageProps
      if (!lat && data?.props?.pageProps) {
        const pageProps = data.props.pageProps;
        
        // Search for lat/lng in nested objects
        function findCoords(obj, depth = 0) {
          if (depth > 5 || !obj || typeof obj !== 'object') return null;
          
          // Check if this object has lat/lng
          if (typeof obj.lat === 'number' && typeof obj.lng === 'number') {
            return { lat: obj.lat, lng: obj.lng };
          }
          if (typeof obj.latitude === 'number' && typeof obj.longitude === 'number') {
            return { lat: obj.latitude, lng: obj.longitude };
          }
          
          // Search in children
          for (const key in obj) {
            const result = findCoords(obj[key], depth + 1);
            if (result) return result;
          }
          return null;
        }
        
        const found = findCoords(pageProps);
        if (found) {
          lat = found.lat;
          lng = found.lng;
        }
      }

      if (lat !== null && lng !== null && 
          !isNaN(lat) && !isNaN(lng) &&
          lat >= -90 && lat <= 90 &&
          lng >= -180 && lng <= 180) {
        return { lat, lng };
      }

      return null;
    } catch (e) {
      sendLog('__NEXT_DATA__ parse error: ' + e.message);
      return null;
    }
  }

  // ─── GeoGuessr: XHR Intercept ─────────────────────────────────

  const originalOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function(method, url) {
    const args = arguments;
    
    // Check if this is a Google Maps metadata request (GeoGuessr)
    if (method.toUpperCase() === 'POST' && 
        (url.includes('google.internal.maps.mapsjs.v1.MapsJsInternalService/GetMetadata') ||
         url.includes('google.internal.maps.mapsjs.v1.MapsJsInternalService/SingleImageSearch'))) {
      
      this.addEventListener('load', function() {
        try {
          const match = this.responseText.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
          if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            
            if (!isNaN(lat) && !isNaN(lng) && 
                lat >= -90 && lat <= 90 && 
                lng >= -180 && lng <= 180) {
              sendLog('📍 XHR intercept: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
              sendCoords(lat, lng, 'xhr-intercept');
            }
          }
        } catch (e) {
          sendLog('XHR parse error: ' + e.message);
        }
      });
    }
    
    return originalOpen.apply(this, args);
  };

  // Fetch interception for GeoGuessr
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : input.url;
    
    if (url && (url.includes('GetMetadata') || url.includes('SingleImageSearch'))) {
      return originalFetch.apply(this, arguments).then(response => {
        const clonedResponse = response.clone();
        clonedResponse.text().then(text => {
          try {
            const match = text.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
            if (match) {
              const lat = parseFloat(match[1]);
              const lng = parseFloat(match[2]);
              
              if (!isNaN(lat) && !isNaN(lng) && 
                  lat >= -90 && lat <= 90 && 
                  lng >= -180 && lng <= 180) {
                sendLog('📍 Fetch intercept: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
                sendCoords(lat, lng, 'fetch-intercept');
              }
            }
          } catch (e) {}
        });
        return response;
      });
    }
    
    return originalFetch.apply(this, arguments);
  };

  // ─── WorldGuessr: Poll __NEXT_DATA__ ─────────────────────────

  let lastWorldGuessrCoords = null;
  let lastWorldGuessrString = null;

  function checkWorldGuessr() {
    const game = detectGame();
    if (game !== 'worldguessr') return;

    const coords = extractWorldGuessrCoords();
    if (coords) {
      const coordString = coords.lat.toFixed(6) + ',' + coords.lng.toFixed(6);
      
      // Only send if different
      if (coordString !== lastWorldGuessrString) {
        lastWorldGuessrString = coordString;
        sendLog('📍 WorldGuessr __NEXT_DATA__: ' + coords.lat.toFixed(4) + ', ' + coords.lng.toFixed(4));
        sendCoords(coords.lat, coords.lng, 'next-data');
      }
    }
  }

  // Poll WorldGuessr every 500ms
  setInterval(checkWorldGuessr, 500);
  
  // Initial check
  setTimeout(checkWorldGuessr, 100);
  setTimeout(checkWorldGuessr, 1000);
  setTimeout(checkWorldGuessr, 3000);

  // ─── MutationObserver for __NEXT_DATA__ changes ──────────────

  const observer = new MutationObserver(() => {
    checkWorldGuessr();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  sendLog('Main world v1.8.22 ready - Dual mode (XHR + __NEXT_DATA__)');

})();
