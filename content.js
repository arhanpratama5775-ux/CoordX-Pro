/**
 * CoordX Pro — Content Script (v1.7.2)
 * 
 * Better extraction with detailed logging
 */

(function () {
  'use strict';

  if (window.__coordxProV172Injected) return;
  window.__coordxProV172Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.7.2 loaded');
  logToBackground('Content v1.7.2 loaded');

  let lastLat = null;
  let lastLng = null;
  let lastRoundIndex = -1;
  let hasLoggedStructure = false;

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

    // Skip if same coords
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

  // Log object structure (first level only)
  function logStructure(name, obj, depth = 0) {
    if (!obj || typeof obj !== 'object') return;
    
    const keys = Object.keys(obj).slice(0, 15);
    logToBackground(name + ': [' + keys.join(', ') + ']');
    
    // Log specific important objects
    if (depth < 2) {
      for (const key of ['rounds', 'round', 'location', 'lat', 'lng', 'coordinates', 'map', 'challenge']) {
        if (obj[key] !== undefined) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            logStructure(name + '.' + key, obj[key], depth + 1);
          } else {
            logToBackground(name + '.' + key + ' = ' + obj[key]);
          }
        }
      }
    }
  }

  // Try to extract coordinates from gameSnapshot
  function extractFromGameSnapshot(snapshot) {
    if (!snapshot) return null;

    // Log structure once
    if (!hasLoggedStructure) {
      logStructure('gameSnapshot', snapshot);
      hasLoggedStructure = true;
    }

    // Try: snapshot.rounds[roundIndex]
    if (snapshot.rounds && Array.isArray(snapshot.rounds)) {
      const roundIndex = snapshot.round ?? 0;
      if (roundIndex >= 0 && roundIndex < snapshot.rounds.length) {
        const r = snapshot.rounds[roundIndex];
        if (r) {
          // Try different coord properties
          const lat = r.lat ?? r.latitude ?? r.y;
          const lng = r.lng ?? r.lon ?? r.longitude ?? r.x;
          if (isValidCoord(lat, lng)) {
            return { lat, lng, roundIndex, source: 'gameSnapshot.rounds[' + roundIndex + ']' };
          }
          // Log what's in the round
          if (!hasLoggedStructure) {
            logStructure('round[' + roundIndex + ']', r);
          }
        }
      }
    }

    // Try: snapshot.location or snapshot.coordinate
    if (snapshot.location) {
      const loc = snapshot.location;
      const lat = loc.lat ?? loc.latitude ?? loc.y;
      const lng = loc.lng ?? loc.lon ?? loc.longitude ?? loc.x;
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'gameSnapshot.location' };
      }
    }

    // Try: snapshot.player
    if (snapshot.player) {
      const p = snapshot.player;
      const lat = p.lat ?? p.latitude;
      const lng = p.lng ?? p.longitude;
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'gameSnapshot.player' };
      }
    }

    // Try: snapshot.panorama
    if (snapshot.panorama) {
      const pan = snapshot.panorama;
      const lat = pan.lat ?? pan.latitude;
      const lng = pan.lng ?? pan.longitude;
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'gameSnapshot.panorama' };
      }
    }

    return null;
  }

  // Try to extract from map property
  function extractFromMap(map) {
    if (!map) return null;

    // Log structure once
    if (!hasLoggedStructure) {
      logStructure('map', map);
    }

    // Try common patterns
    const lat = map.lat ?? map.latitude ?? map.center?.lat ?? map.center?.latitude;
    const lng = map.lng ?? map.lon ?? map.longitude ?? map.center?.lng ?? map.center?.longitude;

    if (isValidCoord(lat, lng)) {
      return { lat, lng, source: 'map' };
    }

    return null;
  }

  // Try to extract from challenge property
  function extractFromChallenge(challenge) {
    if (!challenge) return null;

    // Log structure once
    if (!hasLoggedStructure) {
      logStructure('challenge', challenge);
    }

    // Try common patterns
    if (challenge.location) {
      const lat = challenge.location.lat ?? challenge.location.latitude;
      const lng = challenge.location.lng ?? challenge.location.longitude;
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'challenge.location' };
      }
    }

    return null;
  }

  // WorldGuessr detection
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

  // Main detection
  function detect() {
    const hostname = window.location.hostname;

    // WorldGuessr
    if (hostname.includes('worldguessr.com')) {
      const result = detectWorldGuessr();
      if (result) {
        sendCoords(result.lat, result.lng, result.source);
        return true;
      }
      return false;
    }

    // GeoGuessr
    if (hostname.includes('geoguessr.com')) {
      const script = document.getElementById('__NEXT_DATA__');
      if (!script || !script.textContent) {
        return false;
      }

      let data;
      try {
        data = JSON.parse(script.textContent);
      } catch (e) {
        return false;
      }

      const pp = data?.props?.pageProps;
      if (!pp) return false;

      // Try each extraction method
      let result = null;

      // 1. gameSnapshot
      if (pp.gameSnapshot) {
        result = extractFromGameSnapshot(pp.gameSnapshot);
        if (result) {
          // Check round change
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

      // 2. map
      if (pp.map) {
        result = extractFromMap(pp.map);
        if (result) {
          sendCoords(result.lat, result.lng, result.source);
          return true;
        }
      }

      // 3. challenge
      if (pp.challenge) {
        result = extractFromChallenge(pp.challenge);
        if (result) {
          sendCoords(result.lat, result.lng, result.source);
          return true;
        }
      }

      return false;
    }

    return false;
  }

  // Listen for force check
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'forceCheck') {
      logToBackground('Force check');
      lastLat = null;
      lastLng = null;
      lastRoundIndex = -1;
      hasLoggedStructure = false;
      detect();
      sendResponse({ success: true });
    }
  });

  // Initial
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
      hasLoggedStructure = false;
      setTimeout(init, 300);
      setTimeout(init, 1000);
    }
  }, 500);

  // Next button click
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT')) {
      logToBackground('NEXT clicked');
      lastLat = null;
      lastLng = null;
      lastRoundIndex = -1;
      hasLoggedStructure = false;
      setTimeout(init, 300);
      setTimeout(init, 1000);
      setTimeout(init, 2000);
    }
  }, true);

})();
