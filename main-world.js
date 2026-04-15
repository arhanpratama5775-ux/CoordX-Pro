/**
 * CoordX Pro — Main World Script (v1.8.11)
 * 
 * Filter out bounds/min/max - those are map area, not panorama location
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.11');

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

  let lastLat = null;
  let lastLng = null;

  function sendIfDifferent(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return;
    if (!isValidCoordPath(source)) return;
    
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

  // Search for coords recursively
  function searchForCoords(obj, path, depth) {
    if (depth > 6 || !obj || typeof obj !== 'object') return [];
    
    const found = [];
    
    if (isValidCoord(obj.lat, obj.lng)) {
      const p = path + '.lat/lng';
      if (isValidCoordPath(p)) {
        found.push({ lat: obj.lat, lng: obj.lng, path: p });
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

  function checkNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script?.textContent) return;

    try {
      const data = JSON.parse(script.textContent);
      const pp = data?.props?.pageProps;
      
      if (!pp) return;

      if (!loggedOnce) {
        sendLog('=== pageProps ===');
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

      // Search all objects
      for (const key of Object.keys(pp)) {
        if (pp[key] && typeof pp[key] === 'object') {
          const found = searchForCoords(pp[key], key, 0);
          for (const f of found) {
            sendIfDifferent(f.lat, f.lng, f.path);
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
          sendIfDifferent(f.lat, f.lng, f.path);
        }
      }
    }
  }

  sendLog('Main world v1.8.11');
  checkNextData();
  checkWindow();

  setInterval(checkNextData, 1000);
  setInterval(checkWindow, 2000);

})();
