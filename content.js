/**
 * CoordX Pro — Content Script (v1.5.5)
 * 
 * Simplified approach - less logging, more reliable
 */

(function () {
  'use strict';

  // Prevent double injection
  if (window.__coordxProV155Injected) return;
  window.__coordxProV155Injected = true;

  /* ─── State ──────────────────────────────────────────── */

  let allRounds = [];
  let currentRoundIndex = 0;
  let lastSentKey = '';
  let lastDataStr = '';
  let lastLogTime = 0;

  /* ─── Rate-limited Logging ───────────────────────────── */

  function log(...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    console.log('[CoordX Pro]', msg);
    
    // Rate limit - max 1 log per 500ms
    const now = Date.now();
    if (now - lastLogTime > 500) {
      lastLogTime = now;
      try {
        chrome.runtime.sendMessage({ type: 'log', message: msg, time: new Date().toISOString() }).catch(() => {});
      } catch (e) {}
    }
  }

  /* ─── Validation ─────────────────────────────────────── */

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 &&
      Math.abs(lng) > 0.001;
  }

  /* ─── Send Coords ────────────────────────────────────── */

  function sendCoords(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return;
    
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    
    // Skip if same as last sent
    if (key === lastSentKey) return;
    lastSentKey = key;
    
    log('📍 Round', source, ':', lat.toFixed(4), lng.toFixed(4));
    
    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat, lng, source
      });
    } catch (e) {}
  }

  /* ─── Parse __NEXT_DATA__ ────────────────────────────── */

  function parseNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script) return false;

    const dataStr = script.textContent;
    if (dataStr === lastDataStr) return false;
    
    lastDataStr = dataStr;

    try {
      const data = JSON.parse(dataStr);
      const snapshot = data.props?.pageProps?.gameSnapshot;
      
      if (!snapshot || !snapshot.rounds) return false;

      // Store rounds
      allRounds = [];
      snapshot.rounds.forEach((r, i) => {
        if (isValidCoord(r.lat, r.lng)) {
          allRounds.push({ lat: r.lat, lng: r.lng, index: i });
        }
      });
      
      if (allRounds.length === 0) return false;

      // Get current round
      let roundIndex = snapshot.round ?? 0;
      if (roundIndex >= allRounds.length) roundIndex = allRounds.length - 1;
      if (roundIndex < 0) roundIndex = 0;
      
      currentRoundIndex = roundIndex;

      log('🎮 Game loaded:', allRounds.length, 'rounds, current:', currentRoundIndex + 1);

      // Send current round coords
      const r = allRounds[currentRoundIndex];
      if (r) {
        sendCoords(r.lat, r.lng, `round_${currentRoundIndex + 1}`);
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  /* ─── Check and Update Round ─────────────────────────── */

  function checkAndUpdateRound() {
    // Try to detect current round from DOM
    const roundEl = document.querySelector('[data-qa="round-number"]');
    if (roundEl) {
      const match = roundEl.textContent.match(/(\d+)\s*[\/\|]/);
      if (match) {
        const domRound = parseInt(match[1]) - 1;
        if (domRound >= 0 && domRound !== currentRoundIndex && domRound < allRounds.length) {
          currentRoundIndex = domRound;
          const r = allRounds[currentRoundIndex];
          if (r) {
            sendCoords(r.lat, r.lng, `dom_round_${currentRoundIndex + 1}`);
          }
        }
      }
    }
  }

  /* ─── Click Handler ──────────────────────────────────── */

  function setupClickHandler() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      const text = (target.innerText || target.textContent || '').toUpperCase().trim();
      const className = (target.className || '').toString().toLowerCase();
      
      // Check for NEXT button
      if (text === 'NEXT' || text.includes('NEXT') || className.includes('next')) {
        log('🖱️ NEXT clicked');
        
        // Advance round if possible
        if (currentRoundIndex < allRounds.length - 1) {
          currentRoundIndex++;
          const r = allRounds[currentRoundIndex];
          if (r) {
            lastSentKey = ''; // Force send
            sendCoords(r.lat, r.lng, `next_round_${currentRoundIndex + 1}`);
          }
        } else {
          // Force reparse for new game
          lastDataStr = '';
          setTimeout(parseNextData, 500);
          setTimeout(parseNextData, 1500);
        }
      }
    }, true);
  }

  /* ─── Periodic Check (throttled) ─────────────────────── */

  function setupPeriodicCheck() {
    // Check for new data every 2 seconds
    setInterval(() => {
      const script = document.getElementById('__NEXT_DATA__');
      if (script && script.textContent !== lastDataStr) {
        parseNextData();
      }
    }, 2000);

    // Check for round changes every 3 seconds
    setInterval(() => {
      if (allRounds.length > 0) {
        checkAndUpdateRound();
      }
    }, 3000);
  }

  /* ─── WorldGuessr Support ────────────────────────────── */

  function checkWorldGuessr() {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.src && iframe.src.includes('location=')) {
        const match = iframe.src.match(/location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (isValidCoord(lat, lng)) {
            sendCoords(lat, lng, 'worldguessr');
            return true;
          }
        }
      }
    }
    return false;
  }

  /* ─── Init ───────────────────────────────────────────── */

  function init() {
    const hostname = window.location.hostname;

    if (hostname.includes('geoguessr.com')) {
      parseNextData();
      setupClickHandler();
      setupPeriodicCheck();
      
      // Retry parsing
      setTimeout(parseNextData, 500);
      setTimeout(parseNextData, 1500);
      setTimeout(parseNextData, 3000);
    }

    if (hostname.includes('worldguessr.com')) {
      setInterval(checkWorldGuessr, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
