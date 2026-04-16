/**
 * CoordX Pro — Main World Script (v1.8.15)
 * 
 * Send ALL coordinates with round index info, let content script filter
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.15');

  function sendCoords(lat, lng, source, roundIndex) {
    window.postMessage({
      type: 'COORDX_COORDS',
      lat: lat,
      lng: lng,
      source: source,
      roundIndex: roundIndex  // Include round index from path
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

  // Check if path is valid for panorama location (not map bounds)
  function isValidCoordPath(path) {
    const invalid = ['bounds', 'min', 'max', 'viewport', 'bbox',
      'south', 'north', 'east', 'west', 'sw', 'ne', 'nw', 'se',
      'topleft', 'bottomright', 'corner', 'edge', 'extent'];
    
    const lower = path.toLowerCase();
    for (const bad of invalid) {
      if (lower.includes(bad)) return false;
    }
    return true;
  }

  // Extract round index from path like "gameSnapshot.rounds.2.lat/lng"
  function extractRoundIndex(path) {
    const match = path.match(/rounds\.(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }
    return null;  // Not from rounds array
  }

  // Search for coords recursively
  function searchForCoords(obj, path, depth) {
    if (depth > 6 || !obj || typeof obj !== 'object') return [];
    
    const found = [];
    
    if (isValidCoord(obj.lat, obj.lng)) {
      const p = path + '.lat/lng';
      if (isValidCoordPath(p)) {
        const roundIdx = extractRoundIndex(p);
        found.push({ lat: obj.lat, lng: obj.lng, path: p, roundIndex: roundIdx });
      }
    }
    
    for (const key in obj) {
      const val = obj[key];
      if (val && typeof val === 'object') {
        const nested = searchForCoords(val, path + '.' + key, depth + 1);
        found.push(...nested);
      }
    }
    
    return found;
  }

  let loggedOnce = false;
  let lastSentKey = '';

  function checkNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script?.textContent) return;

    try {
      const data = JSON.parse(script.textContent);
      const pp = data?.props?.pageProps;
      
      if (!pp) return;

      if (!loggedOnce) {
        sendLog('=== pageProps keys ===');
        for (const key of Object.keys(pp)) {
          const val = pp[key];
          if (val === null) {
            sendLog(key + ': null');
          } else if (Array.isArray(val)) {
            sendLog(key + ': Array[' + val.length + ']');
          } else if (typeof val === 'object') {
            sendLog(key + ': {' + Object.keys(val).slice(0, 6).join(', ') + '}');
          } else {
            sendLog(key + ': ' + typeof val);
          }
        }
        loggedOnce = true;
      }

      // Search all objects and send coordinates with round index
      for (const key of Object.keys(pp)) {
        if (pp[key] && typeof pp[key] === 'object') {
          const found = searchForCoords(pp[key], key, 0);
          for (const f of found) {
            // Create unique key to avoid duplicates within same check
            const coordKey = f.path + ':' + f.lat.toFixed(4) + ',' + f.lng.toFixed(4);
            if (coordKey !== lastSentKey) {
              lastSentKey = coordKey;
              sendLog('[MW] Found: ' + f.path + ' = ' + f.lat.toFixed(4) + ', ' + f.lng.toFixed(4) + 
                      (f.roundIndex !== null ? ' (round ' + f.roundIndex + ')' : ''));
              sendCoords(f.lat, f.lng, f.path, f.roundIndex);
            }
          }
        }
      }

    } catch (e) {}
  }

  function checkWindow() {
    const keys = ['__GAME_STATE__', '__INITIAL_STATE__', 'gameState'];
    for (const key of keys) {
      if (window[key]) {
        const found = searchForCoords(window[key], key, 0);
        for (const f of found) {
          sendCoords(f.lat, f.lng, f.path, f.roundIndex);
        }
      }
    }
  }

  sendLog('Main world v1.8.15 ready');
  checkNextData();
  checkWindow();

  // Poll for new data
  setInterval(checkNextData, 1000);
  setInterval(checkWindow, 2000);

})();
