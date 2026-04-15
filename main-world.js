/**
 * CoordX Pro — Main World Script (v1.8.12)
 * 
 * Track current round index and use correct round coordinates
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.12');

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

  // Track current round
  let currentRoundIndex = 0;
  let lastRoundIndex = -1;

  // Detect current round from UI
  function detectRoundFromUI() {
    // Look for "Round X of Y" or similar patterns
    const roundPatterns = [
      /round\s*(\d+)/i,
      /(\d+)\s*\/\s*\d+/,
      /ronde\s*(\d+)/i
    ];

    // Check common UI elements
    const selectors = [
      '[class*="round"]',
      '[class*="Round"]', 
      '[data-qa="round-number"]',
      'h1', 'h2', 'h3', 'h4',
      '.game-header', '.game-info'
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.innerText || el.textContent;
          if (!text) continue;

          for (const pattern of roundPatterns) {
            const match = text.match(pattern);
            if (match) {
              const roundNum = parseInt(match[1]);
              if (roundNum > 0 && roundNum < 100) {
                return roundNum - 1; // Convert to 0-based index
              }
            }
          }
        }
      } catch (e) {}
    }

    // Check URL for round parameter
    try {
      const url = new URL(window.location.href);
      const roundParam = url.searchParams.get('round');
      if (roundParam) {
        const roundNum = parseInt(roundParam);
        if (roundNum > 0) return roundNum - 1;
      }
    } catch (e) {}

    return null;
  }

  // Listen for round change messages from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data?.type === 'COORDX_ROUND_CHANGE') {
      currentRoundIndex = data.roundIndex;
      sendLog('📍 Round index updated to: ' + currentRoundIndex);
    }
  });

  // Get round from gameSnapshot if available
  function getRoundIndexFromGameSnapshot(pp) {
    // Some game modes have a currentRound or roundIndex field
    if (pp.gameSnapshot?.state?.round) {
      return pp.gameSnapshot.state.round;
    }
    if (pp.gameSnapshot?.roundIndex !== undefined) {
      return pp.gameSnapshot.roundIndex;
    }
    if (pp.game?.currentRound !== undefined) {
      return pp.game.currentRound;
    }
    return null;
  }

  let lastLat = null;
  let lastLng = null;

  function sendIfDifferent(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return;
    if (!isValidCoordPath(source)) return;
    
    // Check if this is a "rounds" path and apply round index
    if (source.includes('rounds.')) {
      // Extract which round index this coordinate belongs to
      const match = source.match(/rounds\.(\d+)/);
      if (match) {
        const coordRoundIndex = parseInt(match[1]);
        // Only use coordinates from the CURRENT round
        if (coordRoundIndex !== currentRoundIndex) {
          return; // Skip coordinates from other rounds
        }
      }
    }
    
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

      // Try to detect current round from gameSnapshot
      const gsRound = getRoundIndexFromGameSnapshot(pp);
      if (gsRound !== null && gsRound !== currentRoundIndex) {
        currentRoundIndex = gsRound;
        sendLog('📍 Round from gameSnapshot: ' + currentRoundIndex);
      }

      // Try to detect from UI
      const uiRound = detectRoundFromUI();
      if (uiRound !== null && uiRound !== currentRoundIndex) {
        currentRoundIndex = uiRound;
        sendLog('📍 Round from UI: ' + currentRoundIndex);
      }

      // Log round index if changed
      if (currentRoundIndex !== lastRoundIndex) {
        sendLog('📍 Current round index: ' + currentRoundIndex);
        lastRoundIndex = currentRoundIndex;
      }

      // Search all objects, but only send coordinates from current round
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

  sendLog('Main world v1.8.12');
  checkNextData();
  checkWindow();

  setInterval(checkNextData, 1000);
  setInterval(checkWindow, 2000);

  // Periodically check UI for round changes
  setInterval(() => {
    const uiRound = detectRoundFromUI();
    if (uiRound !== null && uiRound !== currentRoundIndex) {
      currentRoundIndex = uiRound;
      sendLog('📍 Round changed (UI): ' + currentRoundIndex);
      lastLat = null; // Reset to allow new coords
      lastLng = null;
    }
  }, 500);

})();
