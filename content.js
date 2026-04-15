/**
 * CoordX Pro — Content Script (v1.7.3)
 * 
 * Deep structure logging
 */

(function () {
  'use strict';

  if (window.__coordxProV173Injected) return;
  window.__coordxProV173Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.7.3 loaded');
  logToBackground('Content v1.7.3 loaded');

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
      } else if (typeof val === 'number' || typeof val === 'string') {
        // Log coordinate-like values
        if (key.toLowerCase().includes('lat') || key.toLowerCase().includes('lng') ||
            key.toLowerCase().includes('lon') || key === 'x' || key === 'y') {
          logToBackground(name + '.' + key + ' = ' + val);
        }
      }
    }
  }

  // Extract coordinates - try all possible paths
  function extractCoords(snapshot) {
    if (!snapshot) return null;

    // Log structure once
    if (!structureLogged) {
      deepLog('gameSnapshot', snapshot, 3);
      structureLogged = true;
    }

    // Path 1: snapshot.rounds[roundIndex]
    if (snapshot.rounds && Array.isArray(snapshot.rounds)) {
      const roundIndex = snapshot.round ?? 0;
      logToBackground('roundIndex = ' + roundIndex + ', rounds.length = ' + snapshot.rounds.length);

      if (roundIndex >= 0 && roundIndex < snapshot.rounds.length) {
        const r = snapshot.rounds[roundIndex];
        if (r) {
          // Try all possible lat/lng names
          const lat = r.lat ?? r.latitude ?? r.y ?? r.location?.lat ?? r.location?.latitude;
          const lng = r.lng ?? r.lon ?? r.longitude ?? r.x ?? r.location?.lng ?? r.location?.longitude;

          if (isValidCoord(lat, lng)) {
            return { lat, lng, roundIndex, source: 'rounds[' + roundIndex + ']' };
          }
        }
      }
    }

    // Path 2: snapshot.coordinate
    if (snapshot.coordinate) {
      const c = snapshot.coordinate;
      const lat = c.lat ?? c.latitude ?? c.y;
      const lng = c.lng ?? c.lon ?? c.longitude ?? c.x;
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'coordinate' };
      }
    }

    // Path 3: snapshot.location
    if (snapshot.location && typeof snapshot.location === 'object') {
      const loc = snapshot.location;
      const lat = loc.lat ?? loc.latitude ?? loc.y;
      const lng = loc.lng ?? loc.lon ?? loc.longitude ?? loc.x;
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'location' };
      }
    }

    // Path 4: snapshot.panorama
    if (snapshot.panorama && typeof snapshot.panorama === 'object') {
      const pan = snapshot.panorama;
      const lat = pan.lat ?? pan.latitude ?? pan.y;
      const lng = pan.lng ?? pan.lon ?? pan.longitude ?? pan.x;
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'panorama' };
      }
    }

    // Path 5: Direct lat/lng on snapshot
    if (isValidCoord(snapshot.lat, snapshot.lng)) {
      return { lat: snapshot.lat, lng: snapshot.lng, source: 'snapshot direct' };
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

      const snapshot = data?.props?.pageProps?.gameSnapshot;
      if (!snapshot) {
        // Log what's in pageProps
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
