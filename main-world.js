/**
 * CoordX Pro — Main World Script (v1.8.8)
 * 
 * Monitor iframes and DOM for Street View changes
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.8');

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

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0);
  }

  let lastLat = null;
  let lastLng = null;

  function sendIfDifferent(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return;
    
    if (lastLat !== null && lastLng !== null) {
      if (Math.abs(lat - lastLat) < 0.0001 && Math.abs(lng - lastLng) < 0.0001) {
        return;
      }
    }
    
    lastLat = lat;
    lastLng = lng;
    sendLog(source + ': ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
    sendCoords(lat, lng, source);
  }

  // Method 1: Monitor __NEXT_DATA__ for round index changes
  let lastRoundIndex = -1;
  
  function checkNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script?.textContent) return;

    try {
      const data = JSON.parse(script.textContent);
      const snapshot = data?.props?.pageProps?.gameSnapshot;
      
      if (snapshot?.rounds) {
        const roundIndex = snapshot.round ?? 0;
        const rounds = snapshot.rounds;
        
        // Check if round index changed
        if (roundIndex !== lastRoundIndex) {
          sendLog('Round changed: ' + lastRoundIndex + ' -> ' + roundIndex);
          lastRoundIndex = roundIndex;
          
          // Get coords for current round
          let idx = roundIndex;
          if (idx >= rounds.length) idx = rounds.length - 1;
          if (idx < 0) idx = 0;
          
          const r = rounds[idx];
          if (r && isValidCoord(r.lat, r.lng)) {
            // Reset last coords to force update
            lastLat = null;
            lastLng = null;
            sendIfDifferent(r.lat, r.lng, 'next_data');
          }
        }
      }
    } catch (e) {}
  }

  // Method 2: Check for coords in URL hash/params
  function checkUrl() {
    const url = window.location.href;
    
    // Common patterns
    const patterns = [
      /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,  // @lat,lng
      /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,  // !3dlat!4dlng
      /lat=(-?\d+\.?\d*)&lng=(-?\d+\.?\d*)/,
      /location=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (isValidCoord(lat, lng)) {
          sendIfDifferent(lat, lng, 'url');
          return;
        }
      }
    }
  }

  // Method 3: Monitor Street View iframes
  function monitorStreetViewIframes() {
    const iframes = document.querySelectorAll('iframe');
    
    for (const iframe of iframes) {
      const src = iframe.src || '';
      
      // Check for Google Street View iframe
      if (src.includes('google.com/maps') || 
          src.includes('google.com/embed') ||
          src.includes('streetviewpixels') ||
          src.includes('cbk0.google.com')) {
        
        sendLog('Street View iframe found');
        
        // Try to extract coords from iframe src
        const latMatch = src.match(/[!@](-?\d+\.?\d*)[,!]/);
        const lngMatch = src.match(/[!,](-?\d+\.?\d*)[,!]/);
        
        if (latMatch && lngMatch) {
          const lat = parseFloat(latMatch[1]);
          const lng = parseFloat(lngMatch[1]);
          // This is probably wrong, but let's try
        }
        
        // Listen for messages from iframe
        window.addEventListener('message', (event) => {
          if (event.source === iframe.contentWindow) {
            // Check message data for coords
            if (typeof event.data === 'string') {
              try {
                const data = JSON.parse(event.data);
                if (data.lat && data.lng) {
                  sendIfDifferent(data.lat, data.lng, 'iframe_msg');
                }
              } catch (e) {}
            }
          }
        });
      }
    }
  }

  // Method 4: Hook console.log to catch GeoGuessr internal logs
  function hookConsole() {
    const originalLog = console.log;
    console.log = function(...args) {
      // Check for coord patterns in log
      const str = args.join(' ');
      const coordMatch = str.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (isValidCoord(lat, lng)) {
          // Don't log our own messages
          if (!str.includes('[CoordX Pro]')) {
            sendIfDifferent(lat, lng, 'console');
          }
        }
      }
      return originalLog.apply(console, args);
    };
  }

  // Method 5: Try to access panorama via React DevTools hook
  function findPanoramaViaReact() {
    // Look for React fiber nodes with panorama references
    const root = document.getElementById('__next') || document.body;
    
    const searchNode = (node) => {
      if (!node) return;
      
      for (const key in node) {
        if (key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')) {
          const fiber = node[key];
          let current = fiber;
          let depth = 0;
          
          while (current && depth < 50) {
            // Check state
            const state = current.memoizedState;
            if (state) {
              // Recursively search state
              const searchState = (obj, path = '') => {
                if (!obj || typeof obj !== 'object') return;
                
                // Check for panorama
                if (typeof obj.getPosition === 'function') {
                  try {
                    const pos = obj.getPosition();
                    if (pos) {
                      const lat = pos.lat();
                      const lng = pos.lng();
                      if (lat && lng) {
                        sendIfDifferent(lat, lng, 'react_state');
                      }
                    }
                  } catch (e) {}
                }
                
                // Check common properties
                for (const prop of ['panorama', 'streetView', 'location', 'position', 'coords']) {
                  if (obj[prop]) {
                    if (typeof obj[prop].lat === 'function') {
                      try {
                        const lat = obj[prop].lat();
                        const lng = obj[prop].lng?.();
                        if (lat && lng) {
                          sendIfDifferent(lat, lng, 'react_' + prop);
                        }
                      } catch (e) {}
                    }
                    if (isValidCoord(obj[prop].lat, obj[prop].lng)) {
                      sendIfDifferent(obj[prop].lat, obj[prop].lng, 'react_' + prop);
                    }
                  }
                }
              };
              
              searchState(state);
            }
            
            current = current.return;
            depth++;
          }
        }
      }
    };
    
    // Search all elements
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      searchNode(el);
    }
  }

  // Initialize
  sendLog('Main world started');
  hookConsole();
  checkNextData();
  checkUrl();
  monitorStreetViewIframes();

  // Poll __NEXT_DATA__ for round changes
  setInterval(checkNextData, 500);

  // Poll URL changes
  setInterval(checkUrl, 1000);

  // Poll for iframes
  setInterval(monitorStreetViewIframes, 2000);

  // Search React less frequently (expensive)
  setInterval(findPanoramaViaReact, 3000);
  setTimeout(findPanoramaViaReact, 1000);

  sendLog('Main world initialized');

})();
