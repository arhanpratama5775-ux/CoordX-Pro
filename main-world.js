/**
 * CoordX Pro — Main World Script (v1.8.9)
 * 
 * Debug __NEXT_DATA__ structure
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.9');

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
  let loggedOnce = false;

  function sendIfDifferent(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return;
    
    if (lastLat !== null && lastLng !== null) {
      if (Math.abs(lat - lastLat) < 0.0001 && Math.abs(lng - lastLng) < 0.0001) {
        return;
      }
    }
    
    lastLat = lat;
    lastLng = lng;
    sendCoords(lat, lng, source);
  }

  // Check __NEXT_DATA__
  function checkNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script?.textContent) {
      if (!loggedOnce) sendLog('No __NEXT_DATA__');
      return;
    }

    try {
      const data = JSON.parse(script.textContent);
      const pp = data?.props?.pageProps;
      
      if (!pp) {
        if (!loggedOnce) sendLog('No pageProps');
        return;
      }

      // Log structure once
      if (!loggedOnce) {
        sendLog('pageProps keys: ' + Object.keys(pp).join(', '));
        loggedOnce = true;
      }

      // Try gameSnapshot
      if (pp.gameSnapshot) {
        const snapshot = pp.gameSnapshot;
        const roundIndex = snapshot.round;
        const rounds = snapshot.rounds;
        
        if (rounds && Array.isArray(rounds)) {
          // Log every time
          sendLog('round=' + roundIndex + ' rounds=' + rounds.length);
          
          // Try to get coords
          let idx = roundIndex ?? 0;
          if (idx >= rounds.length) idx = rounds.length - 1;
          if (idx < 0) idx = 0;
          
          const r = rounds[idx];
          if (r) {
            const lat = r.lat ?? r.latitude;
            const lng = r.lng ?? r.longitude;
            if (isValidCoord(lat, lng)) {
              sendIfDifferent(lat, lng, 'next_data');
            } else {
              sendLog('round[' + idx + '] no coords');
            }
          }
        }
      }
      
      // Try challenge
      if (pp.challenge) {
        const c = pp.challenge;
        sendLog('challenge keys: ' + Object.keys(c).join(', '));
        
        if (c.location) {
          const lat = c.location.lat;
          const lng = c.location.lng;
          if (isValidCoord(lat, lng)) {
            sendIfDifferent(lat, lng, 'challenge');
          }
        }
      }

    } catch (e) {
      sendLog('Parse error: ' + e.message);
    }
  }

  // Watch for __NEXT_DATA__ content changes
  function watchNextDataChanges() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script) return;

    let lastContent = script.textContent;
    
    setInterval(() => {
      if (script.textContent !== lastContent) {
        lastContent = script.textContent;
        sendLog('__NEXT_DATA__ CHANGED!');
        loggedOnce = false;  // Re-log structure
        checkNextData();
      }
    }, 500);
  }

  // Initialize
  sendLog('Main world started');
  checkNextData();
  watchNextDataChanges();

  // Poll
  setInterval(checkNextData, 1000);

})();
