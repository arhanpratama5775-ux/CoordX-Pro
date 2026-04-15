/**
 * CoordX Pro — Content Script (v1.7.8)
 * 
 * Wait for new coords after NEXT click
 */

(function () {
  'use strict';

  if (window.__coordxProV178Injected) return;
  window.__coordxProV178Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.7.8 loaded');
  logToBackground('Content v1.7.8 loaded');

  let lastLat = null;
  let lastLng = null;
  let lastRoundIndex = -1;
  let lastRoundToken = '';
  let structureLogged = false;
  
  // Track previous round coords to detect actual changes
  let previousRoundLat = null;
  let previousRoundLng = null;
  let waitingForNewRound = false;
  let waitingStartTime = 0;

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 &&
      Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source) {
    if (!isValidCoord(lat, lng)) {
      return false;
    }

    // Check if waiting for new round
    if (waitingForNewRound) {
      const timeSinceWait = Date.now() - waitingStartTime;
      
      // In first 2 seconds after NEXT, only accept DIFFERENT coords
      if (timeSinceWait < 2000) {
        if (previousRoundLat !== null && previousRoundLng !== null) {
          const isSameAsPrevious = 
            Math.abs(lat - previousRoundLat) < 0.001 &&
            Math.abs(lng - previousRoundLng) < 0.001;
          
          if (isSameAsPrevious) {
            // Same as previous round, skip
            return false;
          }
        }
      }
      
      // Got different coords, stop waiting
      waitingForNewRound = false;
      logToBackground('New round coords found after ' + (timeSinceWait) + 'ms');
    }

    // Skip if same as current
    if (lastLat !== null && lastLng !== null) {
      if (Math.abs(lastLat - lat) < 0.0001 && Math.abs(lastLng - lng) < 0.0001) {
        return false;
      }
    }

    lastLat = lat;
    lastLng = lng;

    logToBackground('✅ ' + source + ': ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
    console.log('[CoordX Pro] Found:', lat, lng, 'via', source);

    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat: lat,
        lng: lng,
        source: source
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Extract coordinates from gameSnapshot
  function extractFromGameSnapshot(snapshot) {
    if (!snapshot) return null;

    const rounds = snapshot.rounds;
    if (!rounds || !Array.isArray(rounds) || rounds.length === 0) {
      return null;
    }

    // Log structure once
    if (!structureLogged) {
      const r0 = rounds[0];
      if (r0) {
        logToBackground('round[0] keys: ' + Object.keys(r0).slice(0, 10).join(', '));
      }
      structureLogged = true;
    }

    // Get current round index
    let roundIndex = snapshot.round ?? 0;
    if (roundIndex >= rounds.length) roundIndex = rounds.length - 1;
    if (roundIndex < 0) roundIndex = 0;

    const r = rounds[roundIndex];
    if (!r) return null;

    const lat = r.lat ?? r.latitude ?? r.y ?? r.location?.lat ?? r.location?.latitude;
    const lng = r.lng ?? r.lon ?? r.longitude ?? r.x ?? r.location?.lng ?? r.location?.longitude;

    if (!isValidCoord(lat, lng)) return null;

    // Check if round number changed
    const token = snapshot.token ?? snapshot.gameId ?? '';
    if (roundIndex !== lastRoundIndex || token !== lastRoundToken) {
      logToBackground('Round changed: ' + lastRoundIndex + ' → ' + roundIndex);
      lastRoundIndex = roundIndex;
      lastRoundToken = token;
      
      // Save previous round coords
      if (lastLat !== null && lastLng !== null) {
        previousRoundLat = lastLat;
        previousRoundLng = lastLng;
      }
      
      // Reset current coords
      lastLat = null;
      lastLng = null;
    }

    return { lat, lng, roundIndex, source: 'rounds[' + roundIndex + ']' };
  }

  // Extract from challenge object
  function extractFromChallenge(challenge) {
    if (!challenge) return null;

    // Check for location
    if (challenge.location) {
      const loc = challenge.location;
      const lat = loc.lat ?? loc.latitude ?? loc.y;
      const lng = loc.lng ?? loc.lon ?? loc.longitude ?? loc.x;
      if (isValidCoord(lat, lng)) {
        const token = challenge.id ?? challenge.token ?? '';
        if (token !== lastRoundToken) {
          logToBackground('Challenge changed');
          lastRoundToken = token;
          if (lastLat !== null && lastLng !== null) {
            previousRoundLat = lastLat;
            previousRoundLng = lastLng;
          }
          lastLat = null;
          lastLng = null;
        }
        return { lat, lng, source: 'challenge.location' };
      }
    }

    // Check for rounds array
    if (challenge.rounds && Array.isArray(challenge.rounds)) {
      const roundIndex = challenge.round ?? challenge.currentRound ?? 0;
      let idx = roundIndex;
      
      if (idx >= challenge.rounds.length) idx = challenge.rounds.length - 1;
      if (idx < 0) idx = 0;
      
      if (idx < challenge.rounds.length) {
        const r = challenge.rounds[idx];
        if (r) {
          const lat = r.lat ?? r.latitude ?? r.location?.lat;
          const lng = r.lng ?? r.longitude ?? r.location?.lng;
          if (isValidCoord(lat, lng)) {
            const token = (challenge.id ?? '') + '_' + idx;
            if (token !== lastRoundToken) {
              logToBackground('Challenge round changed');
              lastRoundToken = token;
              if (lastLat !== null && lastLng !== null) {
                previousRoundLat = lastLat;
                previousRoundLng = lastLng;
              }
              lastLat = null;
              lastLng = null;
            }
            return { lat, lng, roundIndex: idx, source: 'challenge.rounds[' + idx + ']' };
          }
        }
      }
    }

    return null;
  }

  // WorldGuessr
  function detectWorldGuessr() {
    const url = window.location.href;
    const locMatch = url.match(/[?&]location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (locMatch) {
      const lat = parseFloat(locMatch[1]);
      const lng = parseFloat(locMatch[2]);
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'url' };
      }
    }

    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.src && iframe.src.includes('location=')) {
        const match = iframe.src.match(/location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (isValidCoord(lat, lng)) {
            return { lat, lng, source: 'iframe' };
          }
        }
      }
    }

    return null;
  }

  // Main detect
  function detect() {
    const hostname = window.location.hostname;

    if (hostname.includes('worldguessr.com')) {
      const result = detectWorldGuessr();
      if (result) {
        sendCoords(result.lat, result.lng, result.source);
        return true;
      }
      return false;
    }

    if (hostname.includes('geoguessr.com')) {
      const script = document.getElementById('__NEXT_DATA__');
      if (!script || !script.textContent) return false;

      let data;
      try {
        data = JSON.parse(script.textContent);
      } catch (e) {
        return false;
      }

      const pp = data?.props?.pageProps;
      if (!pp) return false;

      // Try gameSnapshot first
      if (pp.gameSnapshot) {
        const result = extractFromGameSnapshot(pp.gameSnapshot);
        if (result) {
          sendCoords(result.lat, result.lng, result.source);
          return true;
        }
      }

      // Try challenge
      if (pp.challenge) {
        const result = extractFromChallenge(pp.challenge);
        if (result) {
          sendCoords(result.lat, result.lng, result.source);
          return true;
        }
      }

      return false;
    }

    return false;
  }

  // Force check listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'forceCheck') {
      logToBackground('Force check');
      lastLat = null;
      lastLng = null;
      lastRoundIndex = -1;
      lastRoundToken = '';
      previousRoundLat = null;
      previousRoundLng = null;
      waitingForNewRound = false;
      structureLogged = false;
      detect();
      sendResponse({ success: true });
    }
  });

  // Init
  function init() {
    detect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setTimeout(init, 500);
  setTimeout(init, 1500);
  setTimeout(init, 3000);

  // Poll every 500ms for faster detection
  setInterval(detect, 500);

  // URL change
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      logToBackground('URL changed');
      lastUrl = location.href;
      lastLat = null;
      lastLng = null;
      previousRoundLat = lastLat;
      previousRoundLng = lastLng;
      waitingForNewRound = true;
      waitingStartTime = Date.now();
      lastRoundIndex = -1;
      lastRoundToken = '';
      structureLogged = false;
      setTimeout(detect, 300);
      setTimeout(detect, 1000);
      setTimeout(detect, 2000);
    }
  }, 200);

  // Next button - enter waiting mode
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT') || text.includes('PLAY')) {
      logToBackground('Button: ' + text + ' - waiting for new round');
      
      // Save current coords as previous round
      if (lastLat !== null && lastLng !== null) {
        previousRoundLat = lastLat;
        previousRoundLng = lastLng;
      }
      
      // Enter waiting mode
      waitingForNewRound = true;
      waitingStartTime = Date.now();
      
      // Reset
      lastLat = null;
      lastLng = null;
      lastRoundIndex = -1;
      lastRoundToken = '';
      structureLogged = false;
      
      // Check multiple times with delays
      setTimeout(detect, 100);
      setTimeout(detect, 300);
      setTimeout(detect, 500);
      setTimeout(detect, 1000);
      setTimeout(detect, 1500);
      setTimeout(detect, 2000);
      setTimeout(detect, 3000);
    }
  }, true);

})();
