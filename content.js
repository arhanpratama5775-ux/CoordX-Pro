/**
 * CoordX Pro — Content Script (v1.5.2)
 * 
 * Simplified approach with better logging
 */

(function () {
  'use strict';

  // Prevent double injection
  if (window.__coordxProV152Injected) return;
  window.__coordxProV152Injected = true;

  /* ─── Logging ────────────────────────────────────────── */

  function log(...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    console.log('[CoordX Pro]', msg);
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg, time: new Date().toISOString() }).catch(() => {});
    } catch (e) {}
  }

  log('🚀 Content script v1.5.2 loaded');

  /* ─── State ──────────────────────────────────────────── */

  let allRounds = [];
  let currentRoundIndex = 0;
  let lastSentKey = '';  // Track what we last sent
  let lastDataStr = '';

  /* ─── Validation ─────────────────────────────────────── */

  function isValidCoord(lat, lng) {
    const valid = !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 &&
      Math.abs(lng) > 0.001;
    return valid;
  }

  /* ─── Send Coords ────────────────────────────────────── */

  function sendCoords(lat, lng, source) {
    log('📡 sendCoords called:', source, lat?.toFixed?.(4), lng?.toFixed?.(4));
    
    if (!isValidCoord(lat, lng)) {
      log('❌ Invalid coords, not sending');
      return;
    }
    
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    
    // Always send - remove the duplicate check since we want updates on every round
    lastSentKey = key;
    
    log('📍 SENDING:', source, ':', lat.toFixed(4), lng.toFixed(4));
    
    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat, lng, source
      }, (response) => {
        if (chrome.runtime.lastError) {
          log('❌ Send failed:', chrome.runtime.lastError.message);
        } else {
          log('✅ Send OK:', response);
        }
      });
    } catch (e) {
      log('❌ Send error:', e.message);
    }
  }

  /* ─── Parse __NEXT_DATA__ ────────────────────────────── */

  function parseNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script) {
      log('⚠️ No __NEXT_DATA__ element');
      return false;
    }

    const dataStr = script.textContent;
    if (dataStr === lastDataStr) {
      // Data unchanged
      return false;
    }
    
    lastDataStr = dataStr;
    log('📄 New __NEXT_DATA__ detected');

    try {
      const data = JSON.parse(dataStr);
      const snapshot = data.props?.pageProps?.gameSnapshot;
      
      if (!snapshot) {
        log('⚠️ No gameSnapshot in data');
        return false;
      }

      const rounds = snapshot.rounds;
      if (!rounds || !Array.isArray(rounds)) {
        log('⚠️ No rounds array');
        return false;
      }

      // Store rounds (only valid coords)
      allRounds = [];
      rounds.forEach((r, i) => {
        if (isValidCoord(r.lat, r.lng)) {
          allRounds.push({ lat: r.lat, lng: r.lng, index: i });
        }
      });
      
      if (allRounds.length === 0) {
        log('⚠️ No valid rounds after filtering');
        return false;
      }

      // Get current round from snapshot
      let roundIndex = snapshot.round;
      if (roundIndex === undefined) roundIndex = 0;
      
      // Clamp to valid range
      if (roundIndex >= allRounds.length) {
        log('⚠️ roundIndex', roundIndex, '>= rounds', allRounds.length, '- clamping');
        roundIndex = allRounds.length - 1;
      }
      if (roundIndex < 0) roundIndex = 0;
      
      currentRoundIndex = roundIndex;

      log('🎮 Loaded', allRounds.length, 'rounds, current:', currentRoundIndex + 1);

      // Send current round coords
      const r = allRounds[currentRoundIndex];
      log('🎯 Current round data:', r);
      if (r) {
        sendCoords(r.lat, r.lng, `round_${currentRoundIndex + 1}`);
      } else {
        log('❌ No round data at index', currentRoundIndex);
      }

      return true;
    } catch (e) {
      log('❌ Parse error:', e.message);
      return false;
    }
  }

  /* ─── Watch for Changes ──────────────────────────────── */

  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      // Check if __NEXT_DATA__ changed
      const script = document.getElementById('__NEXT_DATA__');
      if (script && script.textContent !== lastDataStr) {
        log('🔄 MutationObserver detected change');
        parseNextData();
      }
    });

    // Observe body for changes (script might be replaced)
    observer.observe(document.body, { childList: true, subtree: true });
    log('👀 Observer installed');
  }

  /* ─── Click Handler ──────────────────────────────────── */

  function setupClickHandler() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      const text = (target.innerText || target.textContent || '').toUpperCase().trim();
      const className = (target.className || '').toString().toLowerCase();
      
      // Check for NEXT button
      if (text === 'NEXT' || text.includes('NEXT') || className.includes('next')) {
        log('🖱️ NEXT clicked! text="' + text + '"');
        
        // Try to advance round
        if (currentRoundIndex < allRounds.length - 1) {
          currentRoundIndex++;
          const r = allRounds[currentRoundIndex];
          log('➡️ Advancing to round', currentRoundIndex + 1, ':', r);
          if (r) {
            sendCoords(r.lat, r.lng, `next_round_${currentRoundIndex + 1}`);
          }
        } else {
          // At last round - might be starting new game
          log('⏳ At last round, will check for new data...');
          lastDataStr = ''; // Force reparse
          setTimeout(() => {
            parseNextData();
          }, 500);
          setTimeout(() => {
            parseNextData();
          }, 1500);
        }
      }
    }, true);
    
    log('👆 Click handler installed');
  }

  /* ─── DOM Round Detection ────────────────────────────── */

  function detectRoundFromDOM() {
    // Try data-qa attribute
    const roundEl = document.querySelector('[data-qa="round-number"]');
    if (roundEl) {
      const match = roundEl.textContent.match(/(\d+)\s*[\/\|]/);
      if (match) {
        return parseInt(match[1]) - 1;
      }
    }
    
    // Try body text
    const bodyText = document.body?.innerText || '';
    const match = bodyText.match(/ROUND\s*(\d+)\s*[\/\|]/i);
    if (match) {
      return parseInt(match[1]) - 1;
    }
    
    return -1;
  }

  function setupPeriodicCheck() {
    setInterval(() => {
      // Check if data changed
      const script = document.getElementById('__NEXT_DATA__');
      if (script && script.textContent !== lastDataStr) {
        log('⏰ Periodic check found new data');
        parseNextData();
        return;
      }
      
      // Check DOM for round changes
      if (allRounds.length > 0) {
        const domRound = detectRoundFromDOM();
        if (domRound >= 0 && domRound !== currentRoundIndex && domRound < allRounds.length) {
          log('🔄 DOM says round', domRound + 1, '(was', currentRoundIndex + 1, ')');
          currentRoundIndex = domRound;
          const r = allRounds[currentRoundIndex];
          if (r) {
            sendCoords(r.lat, r.lng, `dom_round_${currentRoundIndex + 1}`);
          }
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
      
      // Setup handlers
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
