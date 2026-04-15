/**
 * CoordX Pro — Content Script (v1.7.1)
 * 
 * Simplified detection with better logging
 */

(function () {
  'use strict';

  if (window.__coordxProV171Injected) return;
  window.__coordxProV171Injected = true;

  const LOG_PREFIX = '[CoordX Pro]';

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log(LOG_PREFIX, 'Content v1.7.1 loaded');
  logToBackground('Content v1.7.1 loaded');

  let lastLat = null;
  let lastLng = null;
  let lastRoundIndex = -1;
  let checkCount = 0;

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
    console.log(LOG_PREFIX, 'Found:', lat, lng, 'via', source);

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

  // Parse __NEXT_DATA__
  function parseNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script) {
      return { error: 'No __NEXT_DATA__ element' };
    }
    if (!script.textContent) {
      return { error: '__NEXT_DATA__ empty' };
    }

    try {
      const data = JSON.parse(script.textContent);
      return { data };
    } catch (e) {
      return { error: 'JSON parse failed: ' + e.message };
    }
  }

  // Extract coords from parsed data
  function extractCoordsFromNextData(data) {
    // Try multiple paths
    const paths = [
      // Battle Royale / standard games
      () => {
        const snapshot = data?.props?.pageProps?.gameSnapshot;
        if (!snapshot?.rounds) return null;
        
        const roundIndex = snapshot.round ?? 0;
        const rounds = snapshot.rounds;
        
        if (roundIndex >= 0 && roundIndex < rounds.length) {
          const r = rounds[roundIndex];
          if (r && isValidCoord(r.lat, r.lng)) {
            return { lat: r.lat, lng: r.lng, roundIndex, source: 'next_data_rounds' };
          }
        }
        return null;
      },
      // Try player property
      () => {
        const player = data?.props?.pageProps?.player;
        if (player && isValidCoord(player.lat, player.lng)) {
          return { lat: player.lat, lng: player.lng, source: 'next_data_player' };
        }
        return null;
      },
      // Try location property
      () => {
        const location = data?.props?.pageProps?.location;
        if (location && isValidCoord(location.lat, location.lng)) {
          return { lat: location.lat, lng: location.lng, source: 'next_data_location' };
        }
        return null;
      },
      // Try game property
      () => {
        const game = data?.props?.pageProps?.game;
        if (game?.round?.lat !== undefined && game?.round?.lng !== undefined) {
          if (isValidCoord(game.round.lat, game.round.lng)) {
            return { lat: game.round.lat, lng: game.round.lng, source: 'next_data_game' };
          }
        }
        return null;
      }
    ];

    for (const getPath of paths) {
      const result = getPath();
      if (result) return result;
    }

    return null;
  }

  // WorldGuessr detection
  function detectWorldGuessr() {
    // Check URL params
    const url = window.location.href;
    const locMatch = url.match(/[?&]location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (locMatch) {
      const lat = parseFloat(locMatch[1]);
      const lng = parseFloat(locMatch[2]);
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'url' };
      }
    }

    // Check iframes
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
    checkCount++;
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
      const result = parseNextData();

      if (result.error) {
        // Only log error once every 10 checks to reduce spam
        if (checkCount % 10 === 1) {
          logToBackground('GeoGuessr: ' + result.error);
        }
        return false;
      }

      const coords = extractCoordsFromNextData(result.data);

      if (coords) {
        // Check if round changed
        if (coords.roundIndex !== undefined && coords.roundIndex !== lastRoundIndex) {
          logToBackground('Round changed: ' + lastRoundIndex + ' -> ' + coords.roundIndex);
          lastRoundIndex = coords.roundIndex;
          // Force update even if coords are same
          lastLat = null;
          lastLng = null;
        }
        sendCoords(coords.lat, coords.lng, coords.source);
        return true;
      } else {
        // Log data structure for debugging (only once every 10 checks)
        if (checkCount % 10 === 1) {
          const pp = result.data?.props?.pageProps;
          if (pp) {
            const keys = Object.keys(pp).slice(0, 10).join(', ');
            logToBackground('pageProps keys: ' + keys);
          } else {
            logToBackground('No pageProps');
          }
        }
      }

      return false;
    }

    return false;
  }

  // Listen for force check
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'forceCheck') {
      logToBackground('Force check triggered');
      lastLat = null;
      lastLng = null;
      lastRoundIndex = -1;
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

  // Retry
  setTimeout(init, 500);
  setTimeout(init, 1500);
  setTimeout(init, 3000);

  // Poll every 2 seconds
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
      setTimeout(init, 300);
      setTimeout(init, 1000);
      setTimeout(init, 2000);
    }
  }, true);

})();
