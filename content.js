/**
 * CoordX Pro — Content Script (v1.4.0)
 * 
 * - Added in-extension logging for debugging on mobile/side panel
 * - Simplified - focus on GeoGuessr __NEXT_DATA__ and round detection
 */

(function () {
  'use strict';

  // Prevent double injection
  if (window.__coordxProV140Injected) {
    log('Already injected v1.4.0');
    return;
  }
  window.__coordxProV140Injected = true;

  /* ─── In-Extension Logging ───────────────────────────── */

  const LOG_KEY = 'coordx_logs';
  const MAX_LOGS = 100;

  function log(...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    console.log('[CoordX Pro]', msg);
    
    // Also save to extension storage
    saveLog(msg);
  }

  function saveLog(msg) {
    try {
      chrome.runtime.sendMessage({
        type: 'log',
        message: msg,
        time: new Date().toISOString()
      }).catch(() => {});
    } catch (e) {}
  }

  log('🚀 Content script v1.4.0 loaded');
  log('URL:', window.location.href);
  log('ReadyState:', document.readyState);

  /* ─── Coordinate Validation ───────────────────────────── */

  function isValidCoord(lat, lng) {
    return (
      !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 &&
      Math.abs(lng) > 0.001
    );
  }

  /* ─── Send Coordinates to Background ─────────────────── */

  function sendCoords(lat, lng, source) {
    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat,
        lng,
        source
      }, (response) => {
        if (chrome.runtime.lastError) {
          log('❌ Send failed:', chrome.runtime.lastError.message);
        }
      });
    } catch (e) {
      log('❌ Send error:', e.message);
    }
  }

  /* ─── GeoGuessr: Parse __NEXT_DATA__ ─────────────────── */

  let allRounds = [];
  let currentRoundIndex = 0;
  let lastSentRound = -1;

  function parseNextData() {
    log('Parsing __NEXT_DATA__...');
    
    const script = document.getElementById('__NEXT_DATA__');
    if (!script) {
      log('No __NEXT_DATA__ found');
      return false;
    }

    try {
      const data = JSON.parse(script.textContent);
      log('Parsed __NEXT_DATA__, keys:', Object.keys(data));
      
      const props = data.props?.pageProps;
      if (!props?.gameSnapshot) {
        log('No gameSnapshot in props');
        return false;
      }

      const snapshot = props.gameSnapshot;
      log('gameSnapshot keys:', Object.keys(snapshot));
      log('Current round (from gameSnapshot.round):', snapshot.round);
      
      const rounds = snapshot.rounds;

      if (!rounds || !Array.isArray(rounds)) {
        log('No rounds array');
        return false;
      }

      // Store all rounds
      allRounds = rounds.map((r, i) => ({
        lat: r.lat,
        lng: r.lng,
        panoId: r.panoId,
        roundIndex: i
      })).filter(r => isValidCoord(r.lat, r.lng));

      log('✅ Loaded', allRounds.length, 'rounds');
      allRounds.forEach((r, i) => {
        log(`  Round ${i+1}: lat=${r.lat.toFixed(4)}, lng=${r.lng.toFixed(4)}`);
      });

      // Get current round from gameSnapshot.round (0-indexed)
      if (snapshot.round !== undefined) {
        currentRoundIndex = snapshot.round;
        log('🎮 Current round from gameSnapshot.round:', snapshot.round, '(UI will show Round', snapshot.round + 1, ')');
      }
      
      // Also check if there's a "progress" or "state" field
      if (snapshot.progress !== undefined) {
        log('📊 Progress:', snapshot.progress);
      }
      if (snapshot.state !== undefined) {
        log('📊 State:', snapshot.state);
      }

      // Send all rounds to background
      try {
        chrome.runtime.sendMessage({
          type: 'geoGuessrRounds',
          rounds: allRounds,
          currentRound: currentRoundIndex
        }).catch(() => {});
      } catch (e) {}

      return true;
    } catch (e) {
      log('Parse error:', e.message);
      return false;
    }
  }

  /* ─── Parse Round from DOM ───────────────────────────── */

  function getCurrentRoundFromDOM() {
    // Look for data-qa="round-number"
    const roundEl = document.querySelector('[data-qa="round-number"]');
    if (roundEl) {
      const text = roundEl.textContent || '';
      const match = text.match(/(\d+)\s*[\/\|]/);
      if (match) {
        const round = parseInt(match[1]) - 1; // 0-indexed
        return round;
      }
    }

    // Fallback: look for "ROUND X / Y" pattern in all text
    const allText = document.body?.innerText || '';
    const match = allText.match(/ROUND\s*(\d+)\s*[\/\|]/i);
    if (match) {
      const round = parseInt(match[1]) - 1;
      return round;
    }

    // Look for specific class names that GeoGuessr might use
    const roundIndicators = document.querySelectorAll('[class*="round"], [class*="Round"]');
    for (const el of roundIndicators) {
      const text = el.textContent || '';
      const match = text.match(/(\d+)\s*[\/\|]/);
      if (match) {
        const round = parseInt(match[1]) - 1;
        return round;
      }
    }

    return currentRoundIndex;
  }

  /* ─── Send Current Round Coords ──────────────────────── */

  let ignoreDOMUntil = 0; // Timestamp to ignore DOM round detection

  function sendCurrentRoundCoords(source) {
    const now = Date.now();
    let domRound = currentRoundIndex;
    
    // Only use DOM detection if not in grace period after clicking NEXT
    if (now > ignoreDOMUntil) {
      domRound = getCurrentRoundFromDOM();
    }
    
    // Update round index from DOM if different
    if (domRound !== currentRoundIndex && domRound >= 0 && domRound < allRounds.length) {
      log('🔄 Round changed from DOM:', currentRoundIndex + 1, '->', domRound + 1);
      currentRoundIndex = domRound;
      lastSentRound = -1; // Force resend for new round
    }

    // Send coords if this round hasn't been sent yet
    if (currentRoundIndex !== lastSentRound) {
      const r = allRounds[currentRoundIndex];
      if (r) {
        log('📍 Sending round', currentRoundIndex + 1, ':', r.lat.toFixed(4), r.lng.toFixed(4), 'via', source);
        sendCoords(r.lat, r.lng, 'geoguessr_r' + (currentRoundIndex + 1));
        lastSentRound = currentRoundIndex;
      } else {
        log('⚠️ No round data for index', currentRoundIndex, '- total rounds:', allRounds.length);
      }
    }
  }

  /* ─── WorldGuessr: Iframe Detection ─────────────────── */

  function checkWorldGuessrIframe() {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.src && iframe.src.includes('location=')) {
        const match = iframe.src.match(/location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (isValidCoord(lat, lng)) {
            sendCoords(lat, lng, 'worldguessr_iframe');
            return true;
          }
        }
      }
    }
    return false;
  }

  /* ─── Inject Page Script for Network Hooks ──────────── */

  function injectPageScript() {
    const script = document.createElement('script');
    script.id = 'coordx-page-script';
    script.textContent = `
(function() {
  if (window.__coordxPageV140) return;
  window.__coordxPageV140 = true;
  
  function sendToContent(msg) {
    window.dispatchEvent(new CustomEvent('__coordx_log', { detail: msg }));
  }
  
  sendToContent('[CoordX Pro] Page script v1.4.0 active');

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0);
  }

  function sendCoords(lat, lng, source, round) {
    sendToContent('[CoordX Pro] 📍 Page found: ' + lat + ', ' + lng + ' round: ' + round + ' via ' + source);
    window.dispatchEvent(new CustomEvent('__coordx_page_coords', {
      detail: { lat, lng, source, round }
    }));
  }

  function processGeoGuessrData(data, url) {
    sendToContent('[CoordX Pro] Processing data from: ' + url);
    
    if (data.gameSnapshot) {
      const snapshot = data.gameSnapshot;
      const currentRound = snapshot.round || 0;
      sendToContent('[CoordX Pro] gameSnapshot.round = ' + currentRound);
      
      if (snapshot.rounds) {
        sendToContent('[CoordX Pro] Found ' + snapshot.rounds.length + ' rounds in snapshot');
        snapshot.rounds.forEach((r, i) => {
          if (isValidCoord(r.lat, r.lng)) {
            sendCoords(r.lat, r.lng, 'api_rounds', i + 1);
          }
        });
      }
    }
    
    if (data.rounds && Array.isArray(data.rounds)) {
      sendToContent('[CoordX Pro] Found ' + data.rounds.length + ' rounds directly');
      data.rounds.forEach((r, i) => {
        if (isValidCoord(r.lat, r.lng)) {
          sendCoords(r.lat, r.lng, 'api', i + 1);
        }
      });
    }
    
    if (isValidCoord(data.lat, data.lng)) {
      sendCoords(data.lat, data.lng, 'api_single', null);
    }
  }

  // Hook fetch
  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await _fetch.apply(this, arguments);
    
    if (url.includes('geoguessr.com') && (
        url.includes('/api/') || 
        url.includes('game-snapshot') ||
        url.includes('games')
    )) {
      sendToContent('[CoordX Pro] 🔍 Fetch intercepted: ' + url);
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        const data = JSON.parse(text);
        processGeoGuessrData(data, url);
      } catch (e) {
        sendToContent('[CoordX Pro] Fetch parse error: ' + e.message);
      }
    }
    
    return response;
  };

  // Hook XHR
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._coordx_url = url;
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    const xhr = this;
    xhr.addEventListener('load', function() {
      if (xhr._coordx_url && xhr._coordx_url.includes('geoguessr.com')) {
        sendToContent('[CoordX Pro] 🔍 XHR: ' + xhr._coordx_url);
        try {
          const data = JSON.parse(xhr.responseText);
          processGeoGuessrData(data, xhr._coordx_url);
        } catch (e) {}
      }
    });
    return _send.apply(this, arguments);
  };

  sendToContent('[CoordX Pro] ✅ Network hooks installed');
})();
`;

    try {
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {
      log('❌ Failed to inject page script:', e.message);
    }
  }

  // Listen for page script events
  window.addEventListener('__coordx_page_coords', (event) => {
    const { lat, lng, source, round } = event.detail;
    
    // If round is provided, track it
    if (round && round - 1 !== currentRoundIndex) {
      currentRoundIndex = round - 1;
      lastSentRound = -1;
    }
    
    sendCoords(lat, lng, source);
  });

  // Listen for page script logs
  window.addEventListener('__coordx_log', (event) => {
    log('(page)', event.detail);
  });

  /* ─── Click Listener for NEXT Button ─────────────────── */

  function setupClickListener() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      const text = (target.innerText || target.textContent || '').toUpperCase().trim();
      const ariaLabel = (target.getAttribute('aria-label') || '').toUpperCase();
      const className = target.className || '';
      
      // Check for NEXT button
      if (text === 'NEXT' || ariaLabel === 'NEXT' || 
          text.includes('NEXT') || className.includes('next')) {
        log('🖱️ NEXT button clicked!');
        
        // Advance round
        if (currentRoundIndex < allRounds.length - 1) {
          currentRoundIndex++;
          lastSentRound = -1; // CRITICAL: Reset so new coords will be sent
          log('➡️ Advanced to round', currentRoundIndex + 1);
          
          // Set grace period - ignore DOM detection for 2 seconds
          ignoreDOMUntil = Date.now() + 2000;
          
          // Send coords immediately (after short delay for state to settle)
          setTimeout(() => sendCurrentRoundCoords('next_click'), 100);
        } else {
          log('⚠️ Already at last round');
        }
      }
    }, true);
    
    log('Click listener installed');
  }

  /* ─── Main Init ─────────────────────────────────────── */

  function init() {
    const hostname = window.location.hostname;
    log('🎮 Site:', hostname);

    // Inject page script for network hooks
    injectPageScript();

    if (hostname.includes('geoguessr.com')) {
      // Parse initial data with retries
      parseNextData();
      setTimeout(parseNextData, 500);
      setTimeout(parseNextData, 1500);

      // Setup click listener
      setupClickListener();

      // Check round changes periodically (quietly)
      setInterval(() => sendCurrentRoundCoords('periodic'), 1000);

      // Send initial coords
      setTimeout(() => sendCurrentRoundCoords('init'), 1000);
    }

    if (hostname.includes('worldguessr.com')) {
      setInterval(checkWorldGuessrIframe, 500);
    }
  }

  // Run when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
