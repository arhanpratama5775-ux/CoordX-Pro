/**
 * CoordX Pro — Content Script (v1.7.7)
 * 
 * Fix log spam and round detection
 */

(function () {
  'use strict';

  if (window.__coordxProV176Injected) return;
  window.__coordxProV176Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.7.7 loaded');
  logToBackground('Content v1.7.7 loaded');

  let lastLat = null;
  let lastLng = null;
  let lastRoundIndex = -1;
  let lastRoundToken = '';
  let structureLogged = false;

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 &&
      Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source, forceNew = false) {
    if (!isValidCoord(lat, lng)) {
      return false;
    }

    // Skip if same coords (unless forced)
    if (!forceNew && lastLat !== null && lastLng !== null) {
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

    // Check round change using token or round number
    const currentRound = snapshot.round ?? 0;
    const roundToken = snapshot.token ?? snapshot.gameId ?? '';
    
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
    let roundIndex = currentRound;
    if (roundIndex >= rounds.length) roundIndex = rounds.length - 1;
    if (roundIndex < 0) roundIndex = 0;

    const r = rounds[roundIndex];
    if (!r) return null;

    const lat = r.lat ?? r.latitude ?? r.y ?? r.location?.lat ?? r.location?.latitude;
    const lng = r.lng ?? r.lon ?? r.longitude ?? r.x ?? r.location?.lng ?? r.location?.longitude;

    if (!isValidCoord(lat, lng)) return null;

    // Check if round changed
    const roundChanged = (roundIndex !== lastRoundIndex) || (roundToken !== lastRoundToken);
    
    if (roundChanged) {
      logToBackground('Round changed: ' + lastRoundIndex + ' → ' + roundIndex);
      lastRoundIndex = roundIndex;
      lastRoundToken = roundToken;
      // Force new coords
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
        // Use challenge id or token to detect change
        const token = challenge.id ?? challenge.token ?? '';
        if (token !== lastRoundToken) {
          logToBackground('Challenge changed');
          lastRoundToken = token;
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

  // Poll more frequently for round changes
  setInterval(detect, 1000);

  // URL change
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      logToBackground('URL changed');
      lastUrl = location.href;
      lastLat = null;
      lastLng = null;
      lastRoundIndex = -1;
      lastRoundToken = '';
      structureLogged = false;
      setTimeout(init, 300);
      setTimeout(init, 1000);
    }
  }, 500);

  // Next button - force reset
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT') || text.includes('PLAY')) {
      logToBackground('Button: ' + text);
      lastLat = null;
      lastLng = null;
      lastRoundIndex = -1;
      lastRoundToken = '';
      structureLogged = false;
      setTimeout(detect, 300);
      setTimeout(detect, 1000);
      setTimeout(detect, 2000);
    }
  }, true);

})();
