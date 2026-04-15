/**
 * CoordX Pro — Content Script (v1.3.0)
 * 
 * Simplified - focus on GeoGuessr __NEXT_DATA__ and round detection
 */

(function () {
  'use strict';

  // Prevent double injection
  if (window.__coordxProV130Injected) {
    console.log('[CoordX Pro] Already injected v1.3.0');
    return;
  }
  window.__coordxProV130Injected = true;

  console.log('[CoordX Pro] 🚀 Content script v1.3.0 loaded');
  console.log('[CoordX Pro] URL:', window.location.href);
  console.log('[CoordX Pro] ReadyState:', document.readyState);

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
    console.log('[CoordX Pro] 📍 Sending coords:', lat, lng, 'via', source);
    
    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat,
        lng,
        source
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[CoordX Pro] Send result:', chrome.runtime.lastError.message);
        } else {
          console.log('[CoordX Pro] Send response:', response);
        }
      });
    } catch (e) {
      console.error('[CoordX Pro] Send error:', e);
    }
  }

  /* ─── GeoGuessr: Parse __NEXT_DATA__ ─────────────────── */

  let allRounds = [];
  let currentRoundIndex = 0;
  let lastSentRound = -1;

  function parseNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script) {
      console.log('[CoordX Pro] No __NEXT_DATA__ found');
      return false;
    }

    try {
      const data = JSON.parse(script.textContent);
      const props = data.props?.pageProps;

      if (!props?.gameSnapshot) {
        console.log('[CoordX Pro] No gameSnapshot');
        return false;
      }

      const snapshot = props.gameSnapshot;
      const rounds = snapshot.rounds;

      if (!rounds || !Array.isArray(rounds)) {
        console.log('[CoordX Pro] No rounds array');
        return false;
      }

      // Store all rounds
      allRounds = rounds.map(r => ({
        lat: r.lat,
        lng: r.lng,
        panoId: r.panoId
      })).filter(r => isValidCoord(r.lat, r.lng));

      console.log('[CoordX Pro] ✅ Loaded', allRounds.length, 'rounds');

      // Send all rounds to background
      try {
        chrome.runtime.sendMessage({
          type: 'geoGuessrRounds',
          rounds: allRounds,
          currentRound: 0
        }).catch(() => {});
      } catch (e) {}

      return true;
    } catch (e) {
      console.error('[CoordX Pro] Parse error:', e);
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
        return parseInt(match[1]) - 1; // 0-indexed
      }
    }

    // Fallback: look for "Round X / Y" pattern
    const bodyText = document.body?.innerText || '';
    const match = bodyText.match(/Round\s*(\d+)\s*[\/\|]/i);
    if (match) {
      return parseInt(match[1]) - 1;
    }

    return currentRoundIndex;
  }

  /* ─── Send Current Round Coords ──────────────────────── */

  function sendCurrentRoundCoords(source) {
    const domRound = getCurrentRoundFromDOM();
    
    if (domRound !== currentRoundIndex && domRound >= 0 && domRound < allRounds.length) {
      console.log('[CoordX Pro] Round changed:', currentRoundIndex + 1, '->', domRound + 1);
      currentRoundIndex = domRound;
      lastSentRound = -1; // Reset
    }

    if (currentRoundIndex !== lastSentRound && allRounds[currentRoundIndex]) {
      const r = allRounds[currentRoundIndex];
      console.log('[CoordX Pro] Sending round', currentRoundIndex + 1, ':', r.lat, r.lng);
      sendCoords(r.lat, r.lng, 'geoguessr_r' + (currentRoundIndex + 1) + '_' + source);
      lastSentRound = currentRoundIndex;
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
    console.log('[CoordX Pro] Injecting page script...');
    
    const script = document.createElement('script');
    script.id = 'coordx-page-script';
    script.textContent = `
(function() {
  if (window.__coordxPageV130) return;
  window.__coordxPageV130 = true;
  
  console.log('[CoordX Pro] Page script v1.3.0 active');

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0);
  }

  function sendCoords(lat, lng, source, round) {
    console.log('[CoordX Pro] 📍 Page found:', lat, lng, 'round:', round, 'via', source);
    window.dispatchEvent(new CustomEvent('__coordx_page_coords', {
      detail: { lat, lng, source, round }
    }));
  }

  function processGeoGuessrData(data) {
    if (data.gameSnapshot) {
      const snapshot = data.gameSnapshot;
      const currentRound = snapshot.round || 1;
      
      if (snapshot.rounds) {
        snapshot.rounds.forEach((r, i) => {
          if (isValidCoord(r.lat, r.lng)) {
            sendCoords(r.lat, r.lng, 'api_rounds', i + 1);
          }
        });
      }
    }
    
    if (data.rounds && Array.isArray(data.rounds)) {
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
      console.log('[CoordX Pro] 🔍 Fetch:', url);
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        const data = JSON.parse(text);
        processGeoGuessrData(data);
      } catch (e) {}
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
        console.log('[CoordX Pro] 🔍 XHR:', xhr._coordx_url);
        try {
          const data = JSON.parse(xhr.responseText);
          processGeoGuessrData(data);
        } catch (e) {}
      }
    });
    return _send.apply(this, arguments);
  };

  console.log('[CoordX Pro] ✅ Network hooks installed');
})();
`;

    try {
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      console.log('[CoordX Pro] Page script injected');
    } catch (e) {
      console.error('[CoordX Pro] Failed to inject page script:', e);
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

  /* ─── Click Listener for NEXT Button ─────────────────── */

  function setupClickListener() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      const text = (target.innerText || target.textContent || '').toUpperCase().trim();
      const ariaLabel = (target.getAttribute('aria-label') || '').toUpperCase();
      
      // Check for NEXT button
      if (text === 'NEXT' || ariaLabel === 'NEXT') {
        console.log('[CoordX Pro] 🖱️ NEXT button clicked!');
        
        // Advance round
        if (currentRoundIndex < allRounds.length - 1) {
          currentRoundIndex++;
          lastSentRound = -1;
        }
        
        // Send new coords after delay
        setTimeout(() => sendCurrentRoundCoords('click'), 200);
        setTimeout(() => sendCurrentRoundCoords('click2'), 500);
        setTimeout(() => sendCurrentRoundCoords('click3'), 1000);
      }
    }, true);
  }

  /* ─── Main Init ─────────────────────────────────────── */

  function init() {
    console.log('[CoordX Pro] init() called');
    
    const hostname = window.location.hostname;
    console.log('[CoordX Pro] Hostname:', hostname);

    // Inject page script for network hooks
    injectPageScript();

    if (hostname.includes('geoguessr.com')) {
      console.log('[CoordX Pro] GeoGuessr mode');
      
      // Parse initial data
      parseNextData();
      setTimeout(parseNextData, 500);
      setTimeout(parseNextData, 1000);

      // Setup click listener
      setupClickListener();

      // Check round changes periodically
      setInterval(() => {
        sendCurrentRoundCoords('periodic');
      }, 1000);

      // Send initial coords
      setTimeout(() => sendCurrentRoundCoords('init'), 1000);
    }

    if (hostname.includes('worldguessr.com')) {
      console.log('[CoordX Pro] WorldGuessr mode');
      setInterval(checkWorldGuessrIframe, 500);
    }
  }

  // Run when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[CoordX Pro] DOM loaded');
      init();
    });
  } else {
    console.log('[CoordX Pro] DOM already ready');
    init();
  }

})();
