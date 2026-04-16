/**
 * CoordX Pro — Main World Script (v1.8.23)
 * 
 * Dual approach:
 * - GeoGuessr: XHR intercept Google Maps API
 * - WorldGuessr: Parse __NEXT_DATA__ + watch URL for round changes
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.23');

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
      if (!scriptTag) {
        sendLog('WorldGuessr: No __NEXT_DATA__ found');
        return null;
      }

      const data = JSON.parse(scriptTag.textContent);
      
      // Log structure for debugging (only once)
      if (!window.__coordxLoggedStructure) {
        sendLog('WorldGuessr __NEXT_DATA__ keys: ' + Object.keys(data).join(', '));
        if (data.props?.pageProps) {
          sendLog('pageProps keys: ' + Object.keys(data.props.pageProps).join(', '));
        }
        window.__coordxLoggedStructure = true;
      }
      
      let lat = null;
      let lng = null;

      // Try different paths for coordinates
      const tryPath = (obj, path) => {
        if (!obj) return null;
        const keys = path.split('.');
        let current = obj;
        for (const key of keys) {
          if (current && typeof current === 'object' && key in current) {
            current = current[key];
          } else {
            return null;
          }
        }
        return current;
      };

      // Path 1: game.rounds array (latest round)
      const rounds = tryPath(data, 'props.pageProps.game.rounds');
      if (rounds && Array.isArray(rounds) && rounds.length > 0) {
        // Get last round
        const round = rounds[rounds.length - 1];
        lat = round.lat || round.latitude;
        lng = round.lng || round.longitude || round.lng;
        if (lat && lng) {
          sendLog('Found in rounds[' + (rounds.length - 1) + ']');
        }
      }

      // Path 2: rounds directly in pageProps
      if (!lat) {
        const directRounds = tryPath(data, 'props.pageProps.rounds');
        if (directRounds && Array.isArray(directRounds) && directRounds.length > 0) {
          const round = directRounds[directRounds.length - 1];
          lat = round.lat || round.latitude;
          lng = round.lng || round.longitude || round.lng;
          if (lat && lng) {
            sendLog('Found in pageProps.rounds');
          }
        }
      }

      // Path 3: currentRound
      if (!lat) {
        const currentRound = tryPath(data, 'props.pageProps.currentRound');
        if (currentRound) {
          lat = currentRound.lat || currentRound.latitude;
          lng = currentRound.lng || currentRound.longitude || currentRound.lng;
          if (lat && lng) {
            sendLog('Found in currentRound');
          }
        }
      }

      // Path 4: location
      if (!lat) {
        const location = tryPath(data, 'props.pageProps.location');
        if (location) {
          lat = location.lat || location.latitude;
          lng = location.lng || location.longitude || location.lng;
          if (lat && lng) {
            sendLog('Found in location');
          }
        }
      }

      // Path 5: streetView
      if (!lat) {
        const sv = tryPath(data, 'props.pageProps.streetView');
        if (sv) {
          lat = sv.lat || sv.latitude;
          lng = sv.lng || sv.longitude || sv.lng;
          if (lat && lng) {
            sendLog('Found in streetView');
          }
        }
      }

      // Path 6: state.rounds (for client-side state)
      if (!lat && data.props?.pageProps?.initialState) {
        const state = data.props.pageProps.initialState;
        if (state.rounds && Array.isArray(state.rounds)) {
          const round = state.rounds[state.rounds.length - 1];
          lat = round.lat || round.latitude;
          lng = round.lng || round.longitude || round.lng;
          if (lat && lng) {
            sendLog('Found in initialState.rounds');
          }
        }
      }

      // Validate coords
      if (lat !== null && lng !== null && 
          !isNaN(lat) && !isNaN(lng) &&
          lat >= -90 && lat <= 90 &&
          lng >= -180 && lng <= 180) {
        return { lat, lng };
      }

      return null;
    } catch (e) {
      sendLog('WorldGuessr parse error: ' + e.message);
      return null;
    }
  }

  // ─── GeoGuessr: XHR Intercept ─────────────────────────────────

  const originalOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function(method, url) {
    const args = arguments;
    
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
              sendLog('📍 XHR: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
              sendCoords(lat, lng, 'xhr');
            }
          }
        } catch (e) {}
      });
    }
    
    return originalOpen.apply(this, args);
  };

  // Fetch interception
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
                sendLog('📍 Fetch: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
                sendCoords(lat, lng, 'fetch');
              }
            }
          } catch (e) {}
        });
        return response;
      });
    }
    
    return originalFetch.apply(this, arguments);
  };

  // ─── WorldGuessr: Poll + URL Watch ─────────────────────────

  let lastWorldGuessrCoords = null;
  let lastWorldGuessrUrl = null;

  function checkWorldGuessr() {
    const game = detectGame();
    if (game !== 'worldguessr') return;

    const currentUrl = window.location.href;
    
    // Check if URL changed (new round)
    if (lastWorldGuessrUrl && lastWorldGuessrUrl !== currentUrl) {
      sendLog('WorldGuessr URL changed, resetting');
      lastWorldGuessrCoords = null;
    }
    lastWorldGuessrUrl = currentUrl;

    const coords = extractWorldGuessrCoords();
    if (coords) {
      const coordString = coords.lat.toFixed(6) + ',' + coords.lng.toFixed(6);
      
      // Send if different from last
      if (coordString !== lastWorldGuessrCoords) {
        lastWorldGuessrCoords = coordString;
        sendLog('📍 WorldGuessr: ' + coords.lat.toFixed(4) + ', ' + coords.lng.toFixed(4));
        sendCoords(coords.lat, coords.lng, 'nextdata');
      }
    }
  }

  // Poll WorldGuessr
  setInterval(checkWorldGuessr, 500);
  
  // Initial checks
  setTimeout(checkWorldGuessr, 100);
  setTimeout(checkWorldGuessr, 1000);
  setTimeout(checkWorldGuessr, 3000);

  // ─── Watch for DOM changes ───────────────────────────────────

  const observer = new MutationObserver(() => {
    if (detectGame() === 'worldguessr') {
      checkWorldGuessr();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // ─── Also try window.history for SPA navigation ───────────────

  const originalPushState = history.pushState;
  history.pushState = function() {
    originalPushState.apply(this, arguments);
    if (detectGame() === 'worldguessr') {
      sendLog('History pushState detected');
      lastWorldGuessrCoords = null;
      setTimeout(checkWorldGuessr, 100);
    }
  };

  window.addEventListener('popstate', () => {
    if (detectGame() === 'worldguessr') {
      sendLog('Popstate detected');
      lastWorldGuessrCoords = null;
      setTimeout(checkWorldGuessr, 100);
    }
  });

  sendLog('Main world v1.8.23 ready');

})();
