/**
 * CoordX Pro — Main World Script (v1.8.10)
 * 
 * Debug ALL data sources
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.10');

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
    sendLog('✅ ' + source + ': ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
    sendCoords(lat, lng, source);
  }

  // Recursively search for coords
  function searchForCoords(obj, path = '', depth = 0) {
    if (depth > 5 || !obj || typeof obj !== 'object') return [];
    
    const found = [];
    
    // Check this object
    if (isValidCoord(obj.lat, obj.lng)) {
      found.push({ lat: obj.lat, lng: obj.lng, path: path + '.lat/lng' });
    }
    if (isValidCoord(obj.latitude, obj.longitude)) {
      found.push({ lat: obj.latitude, lng: obj.longitude, path: path + '.latitude/longitude' });
    }
    
    // Check nested objects
    for (const key in obj) {
      const val = obj[key];
      if (val && typeof val === 'object') {
        const nested = searchForCoords(val, path + '.' + key, depth + 1);
        found.push(...nested);
      }
    }
    
    return found;
  }

  // Check __NEXT_DATA__
  let loggedOnce = false;
  let lastContentHash = '';

  function checkNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script?.textContent) return;

    const contentHash = script.textContent.length + '_' + script.textContent.substring(0, 100);
    const contentChanged = contentHash !== lastContentHash;
    lastContentHash = contentHash;

    try {
      const data = JSON.parse(script.textContent);
      const pp = data?.props?.pageProps;
      
      if (!pp) return;

      // Log structure on first run or change
      if (!loggedOnce || contentChanged) {
        sendLog('=== pageProps ===');
        for (const key of Object.keys(pp)) {
          const val = pp[key];
          if (val === null) {
            sendLog(key + ': null');
          } else if (typeof val === 'object') {
            const subKeys = Object.keys(val).slice(0, 10);
            sendLog(key + ': {' + subKeys.join(', ') + '}');
          } else {
            sendLog(key + ': ' + typeof val);
          }
        }
        loggedOnce = true;
      }

      // Search ALL objects for coords
      const allFound = [];
      
      for (const key of ['gameSnapshot', 'challenge', 'map', 'creator', 'game']) {
        if (pp[key]) {
          const found = searchForCoords(pp[key], key);
          if (found.length > 0) {
            allFound.push(...found);
          }
        }
      }

      // Log found coords
      if (allFound.length > 0) {
        for (const f of allFound) {
          sendIfDifferent(f.lat, f.lng, f.path);
        }
      }

    } catch (e) {
      sendLog('Error: ' + e.message);
    }
  }

  // Also check window object
  function checkWindow() {
    const keys = ['__GAME_STATE__', '__INITIAL_STATE__', 'gameState', 'INITIAL_DATA', '__DATA__'];
    
    for (const key of keys) {
      if (window[key]) {
        sendLog('Found window.' + key);
        const found = searchForCoords(window[key], key);
        for (const f of found) {
          sendIfDifferent(f.lat, f.lng, f.path);
        }
      }
    }
  }

  // Initialize
  sendLog('Main world started');
  checkNextData();
  checkWindow();

  // Poll
  setInterval(checkNextData, 1000);
  setInterval(checkWindow, 2000);

})();
