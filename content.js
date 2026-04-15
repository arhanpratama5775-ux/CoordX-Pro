/**
 * CoordX Pro — Content Script (v1.5.0)
 * 
 * Simplified approach:
 * - Watch __NEXT_DATA__ for changes using MutationObserver
 * - Send coords whenever round data changes
 */

(function () {
  'use strict';

  // Prevent double injection
  if (window.__coordxProV150Injected) return;
  window.__coordxProV150Injected = true;

  /* ─── Logging ────────────────────────────────────────── */

  function log(...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    console.log('[CoordX Pro]', msg);
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg, time: new Date().toISOString() }).catch(() => {});
    } catch (e) {}
  }

  log('🚀 Content script v1.5.0 loaded');

  /* ─── State ──────────────────────────────────────────── */

  let allRounds = [];
  let currentRoundIndex = 0;
  let lastSentCoords = '';

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
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (key === lastSentCoords) return; // Don't send same coords twice
    lastSentCoords = key;
    
    log('📍', source, ':', lat.toFixed(4), lng.toFixed(4));
    
    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat, lng, source
      });
    } catch (e) {
      log('❌ Send failed:', e.message);
    }
  }

  /* ─── Parse __NEXT_DATA__ ────────────────────────────── */

  let lastDataStr = '';

  function parseNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script) return false;

    const dataStr = script.textContent;
    if (dataStr === lastDataStr) return false; // No change
    lastDataStr = dataStr;

    try {
      const data = JSON.parse(dataStr);
      const snapshot = data.props?.pageProps?.gameSnapshot;
      if (!snapshot) return false;

      const rounds = snapshot.rounds;
      if (!rounds || !Array.isArray(rounds)) return false;

      // Store rounds
      allRounds = rounds.filter(r => isValidCoord(r.lat, r.lng));
      if (allRounds.length === 0) return false;

      // Get current round - clamp to valid range
      let roundIndex = snapshot.round || 0;
      if (roundIndex >= allRounds.length) roundIndex = allRounds.length - 1;
      if (roundIndex < 0) roundIndex = 0;
      currentRoundIndex = roundIndex;

      log('🎮 Loaded', allRounds.length, 'rounds, current:', currentRoundIndex + 1);

      // Send current round coords
      const r = allRounds[currentRoundIndex];
      if (r) {
        sendCoords(r.lat, r.lng, `round_${currentRoundIndex + 1}`);
      }

      return true;
    } catch (e) {
      log('❌ Parse error:', e.message);
      return false;
    }
  }

  /* ─── Watch for Changes ──────────────────────────────── */

  function setupObserver() {
    // Watch __NEXT_DATA__ script element for changes
    const observer = new MutationObserver(() => {
      parseNextData();
    });

    // Observe the script element
    const script = document.getElementById('__NEXT_DATA__');
    if (script) {
      observer.observe(script, { childList: true, characterData: true, subtree: true });
    }

    // Also observe body for __NEXT_DATA__ changes (in case script is replaced)
    observer.observe(document.body, { childList: true, subtree: true });

    log('👀 Observer installed');
  }

  /* ─── Click Handler ──────────────────────────────────── */

  function setupClickHandler() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      const text = (target.innerText || target.textContent || '').toUpperCase().trim();
      
      if (text === 'NEXT' || text.includes('NEXT')) {
        log('🖱️ NEXT clicked');
        
        // Advance round if possible
        if (currentRoundIndex < allRounds.length - 1) {
          currentRoundIndex++;
          lastSentCoords = ''; // Force resend
          const r = allRounds[currentRoundIndex];
          if (r) {
            sendCoords(r.lat, r.lng, `next_round_${currentRoundIndex + 1}`);
          }
        } else {
          // At last round - check if __NEXT_DATA__ updated (maybe new game started)
          log('⏳ At last round, checking for new data...');
          lastDataStr = ''; // Force reparse
          setTimeout(parseNextData, 500);
        }
      }
    }, true);
  }

  /* ─── DOM Round Detection ────────────────────────────── */

  function detectRoundFromDOM() {
    // Look for "ROUND X / Y" in page
    const roundEl = document.querySelector('[data-qa="round-number"]');
    if (roundEl) {
      const match = roundEl.textContent.match(/(\d+)\s*[\/\|]/);
      if (match) {
        return parseInt(match[1]) - 1; // 0-indexed
      }
    }
    
    // Fallback: search body text
    const bodyText = document.body?.innerText || '';
    const match = bodyText.match(/ROUND\s*(\d+)\s*[\/\|]/i);
    if (match) {
      return parseInt(match[1]) - 1;
    }
    
    return -1;
  }

  // Periodic check for round changes
  function setupPeriodicCheck() {
    setInterval(() => {
      const domRound = detectRoundFromDOM();
      if (domRound >= 0 && domRound !== currentRoundIndex && domRound < allRounds.length) {
        log('🔄 DOM says round', domRound + 1, '(was', currentRoundIndex + 1, ')');
        currentRoundIndex = domRound;
        lastSentCoords = '';
        const r = allRounds[currentRoundIndex];
        if (r) {
          sendCoords(r.lat, r.lng, `dom_round_${currentRoundIndex + 1}`);
        }
      }
    }, 1000);
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
    log('🎮 Site:', hostname);

    if (hostname.includes('geoguessr.com')) {
      // Initial parse
      parseNextData();
      
      // Setup observers and handlers
      setupObserver();
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
