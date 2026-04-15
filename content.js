/**
 * CoordX Pro — Content Script (v1.7.4)
 * 
 * Fix roundIndex out of bounds issue
 */

(function () {
  'use strict';

  if (window.__coordxProV174Injected) return;
  window.__coordxProV174Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.7.4 loaded');
  logToBackground('Content v1.7.4 loaded');

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
  function deepLog(name, obj, maxDepth = 2, currentDepth = 0) {
    if (!obj || typeof obj !== 'object' || currentDepth >= maxDepth) return;

    const keys = Object.keys(obj);
    logToBackground(name + ' keys: [' + keys.slice(0, 20).join(', ') + ']');

    for (const key of keys) {
      const val = obj[key];
      if (val && typeof val === 'object' && !Array.isArray(val) && currentDepth < maxDepth - 1) {
        deepLog(name + '.' + key, val, maxDepth, currentDepth + 1);
      } else if (Array.isArray(val) && val.length > 0 && currentDepth < maxDepth - 1) {
        logToBackground(name + '.' + key + ' = Array[' + val.length + ']');
        if (val[0] && typeof val[0] === 'object') {
          deepLog(name + '.' + key + '[0]', val[0], maxDepth, currentDepth + 1);
        }
      }
    }
  }

  // Extract coordinates
  function extractCoords(snapshot) {
    if (!snapshot) return null;

    // Log structure once
    if (!structureLogged) {
      deepLog('gameSnapshot', snapshot, 3);
      structureLogged = true;
    }

    const rounds = snapshot.rounds;
    if (!rounds || !Array.isArray(rounds) || rounds.length === 0) {
      return null;
    }

    let roundIndex = snapshot.round ?? 0;
    logToBackground('roundIndex = ' + roundIndex + ', rounds.length = ' + rounds.length);

    // Fix: roundIndex might be out of bounds (game ended) or 1-indexed
    // Try multiple approaches:
    
    // Approach 1: Use roundIndex as-is if valid
    if (roundIndex >= 0 && roundIndex < rounds.length) {
      const r = rounds[roundIndex];
      if (r) {
        const lat = r.lat ?? r.latitude ?? r.y ?? r.location?.lat ?? r.location?.latitude;
        const lng = r.lng ?? r.lon ?? r.longitude ?? r.x ?? r.location?.lng ?? r.location?.longitude;
        if (isValidCoord(lat, lng)) {
          return { lat, lng, roundIndex, source: 'rounds[' + roundIndex + ']' };
        }
        logToBackground('rounds[' + roundIndex + '] no valid coords');
      }
    }

    // Approach 2: Try roundIndex - 1 (1-indexed)
    if (roundIndex > 0 && roundIndex <= rounds.length) {
      const r = rounds[roundIndex - 1];
      if (r) {
        const lat = r.lat ?? r.latitude ?? r.y ?? r.location?.lat ?? r.location?.latitude;
        const lng = r.lng ?? r.lon ?? r.longitude ?? r.x ?? r.location?.lng ?? r.location?.longitude;
        if (isValidCoord(lat, lng)) {
          logToBackground('Using 1-indexed: rounds[' + (roundIndex - 1) + ']');
          return { lat, lng, roundIndex: roundIndex - 1, source: 'rounds[' + (roundIndex - 1) + ']' };
        }
      }
    }

    // Approach 3: roundIndex >= length, try last round (current game)
    if (roundIndex >= rounds.length && rounds.length > 0) {
      const r = rounds[rounds.length - 1];
      if (r) {
        const lat = r.lat ?? r.latitude ?? r.y ?? r.location?.lat ?? r.location?.latitude;
        const lng = r.lng ?? r.lon ?? r.longitude ?? r.x ?? r.location?.lng ?? r.location?.longitude;
        if (isValidCoord(lat, lng)) {
          logToBackground('Using last round: rounds[' + (rounds.length - 1) + ']');
          return { lat, lng, roundIndex: rounds.length - 1, source: 'rounds[last]' };
        }
      }
    }

    // Approach 4: Try ALL rounds and find one with valid coords
    for (let i = rounds.length - 1; i >= 0; i--) {
      const r = rounds[i];
      if (r) {
        const lat = r.lat ?? r.latitude ?? r.y ?? r.location?.lat ?? r.location?.latitude;
        const lng = r.lng ?? r.lon ?? r.longitude ?? r.x ?? r.location?.lng ?? r.location?.longitude;
        if (isValidCoord(lat, lng)) {
          logToBackground('Found in rounds[' + i + ']');
          return { lat, lng, roundIndex: i, source: 'rounds[' + i + ']' };
        }
      }
    }

    logToBackground('No valid coords in any round!');
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

      const snapshot = data?.props?.pageProps?.gameSnapshot;
      if (!snapshot) {
        const pp = data?.props?.pageProps;
        if (pp && !structureLogged) {
          logToBackground('pageProps: ' + Object.keys(pp).join(', '));
        }
        return false;
      }

      const result = extractCoords(snapshot);
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
