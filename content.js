/**
 * CoordX Pro — Content Script (v1.7.5)
 * 
 * Handle changed GeoGuessr structure (no gameSnapshot)
 */

(function () {
  'use strict';

  if (window.__coordxProV175Injected) return;
  window.__coordxProV175Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.7.5 loaded');
  logToBackground('Content v1.7.5 loaded');

  let lastLat = null;
  let lastLng = null;
  let lastRoundIndex = -1;
  let structureLogged = false;

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
      logToBackground('Invalid coords: ' + lat + ', ' + lng);
      return false;
    }

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
      logToBackground('Send failed: ' + e.message);
      return false;
    }
  }

  // Deep log object
  function deepLog(name, obj, maxDepth = 3, currentDepth = 0) {
    if (!obj || typeof obj !== 'object' || currentDepth >= maxDepth) return;

    const keys = Object.keys(obj);
    logToBackground(name + ' keys: [' + keys.slice(0, 15).join(', ') + ']');

    for (const key of keys) {
      const val = obj[key];
      if (val && typeof val === 'object' && !Array.isArray(val) && currentDepth < maxDepth - 1) {
        deepLog(name + '.' + key, val, maxDepth, currentDepth + 1);
      } else if (Array.isArray(val) && val.length > 0) {
        logToBackground(name + '.' + key + ' = Array[' + val.length + ']');
        if (typeof val[0] === 'object' && currentDepth < maxDepth - 1) {
          deepLog(name + '.' + key + '[0]', val[0], maxDepth, currentDepth + 1);
        }
      } else if (typeof val === 'number' && !isNaN(val)) {
        // Log all numbers that could be coords
        if (Math.abs(val) >= -180 && Math.abs(val) <= 180) {
          logToBackground(name + '.' + key + ' = ' + val);
        }
      }
    }
  }

  // Try to extract from challenge object
  function extractFromChallenge(challenge) {
    if (!challenge) return null;

    logToBackground('Checking challenge...');
    deepLog('challenge', challenge);

    // Try common paths
    if (challenge.location) {
      const loc = challenge.location;
      const lat = loc.lat ?? loc.latitude ?? loc.y;
      const lng = loc.lng ?? loc.lon ?? loc.longitude ?? loc.x;
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'challenge.location' };
      }
    }

    if (challenge.rounds && Array.isArray(challenge.rounds)) {
      const roundIndex = challenge.round ?? 0;
      let idx = roundIndex;
      
      // Handle out of bounds
      if (idx >= challenge.rounds.length) idx = challenge.rounds.length - 1;
      if (idx < 0) idx = 0;
      
      if (idx < challenge.rounds.length) {
        const r = challenge.rounds[idx];
        if (r) {
          const lat = r.lat ?? r.latitude ?? r.location?.lat;
          const lng = r.lng ?? r.longitude ?? r.location?.lng;
          if (isValidCoord(lat, lng)) {
            return { lat, lng, roundIndex: idx, source: 'challenge.rounds[' + idx + ']' };
          }
        }
      }
    }

    // Direct coords
    const lat = challenge.lat ?? challenge.latitude;
    const lng = challenge.lng ?? challenge.longitude ?? challenge.lon;
    if (isValidCoord(lat, lng)) {
      return { lat, lng, source: 'challenge direct' };
    }

    return null;
  }

  // Try to extract from gameSnapshot (old format)
  function extractFromGameSnapshot(snapshot) {
    if (!snapshot) return null;

    const rounds = snapshot.rounds;
    if (!rounds || !Array.isArray(rounds) || rounds.length === 0) {
      return null;
    }

    let roundIndex = snapshot.round ?? 0;
    
    // Handle out of bounds
    if (roundIndex >= rounds.length) roundIndex = rounds.length - 1;
    if (roundIndex < 0) roundIndex = 0;

    const r = rounds[roundIndex];
    if (r) {
      const lat = r.lat ?? r.latitude ?? r.y ?? r.location?.lat;
      const lng = r.lng ?? r.longitude ?? r.x ?? r.location?.lng;
      if (isValidCoord(lat, lng)) {
        return { lat, lng, roundIndex, source: 'gameSnapshot.rounds[' + roundIndex + ']' };
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

      // Log pageProps once
      if (!structureLogged) {
        logToBackground('pageProps: ' + Object.keys(pp).join(', '));
      }

      // Try gameSnapshot (old format)
      if (pp.gameSnapshot) {
        if (!structureLogged) {
          deepLog('gameSnapshot', pp.gameSnapshot);
        }
        const result = extractFromGameSnapshot(pp.gameSnapshot);
        if (result) {
          sendCoords(result.lat, result.lng, result.source);
          return true;
        }
      }

      // Try challenge (new format)
      if (pp.challenge) {
        const result = extractFromChallenge(pp.challenge);
        if (result) {
          if (result.roundIndex !== undefined && result.roundIndex !== lastRoundIndex) {
            logToBackground('Round: ' + lastRoundIndex + ' → ' + result.roundIndex);
            lastRoundIndex = result.roundIndex;
            lastLat = null;
            lastLng = null;
          }
          sendCoords(result.lat, result.lng, result.source);
          return true;
        }
      }

      // Try creator
      if (pp.creator && !structureLogged) {
        deepLog('creator', pp.creator);
      }

      structureLogged = true;
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

  setInterval(detect, 2000);

  // URL change
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      logToBackground('URL changed');
      lastUrl = location.href;
      lastLat = null;
      lastLng = null;
      lastRoundIndex = -1;
      structureLogged = false;
      setTimeout(init, 300);
      setTimeout(init, 1000);
    }
  }, 500);

  // Next button
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT')) {
      logToBackground('NEXT clicked');
      lastLat = null;
      lastLng = null;
      lastRoundIndex = -1;
      structureLogged = false;
      setTimeout(init, 300);
      setTimeout(init, 1000);
      setTimeout(init, 2000);
    }
  }, true);

})();
