/**
 * CoordX Pro — Content Script (v1.2.5)
 *
 * Supports:
 * - WorldGuessr (iframe URL detection)
 * - GeoGuessr (Store all rounds + detect round from URL/DOM/API)
 */

(function () {
  'use strict';

  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  console.log('[CoordX Pro] 🚀 Content script v1.2.5 loaded on:', window.location.href);

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

  let lastSentCoords = null;
  let lastIframeSrc = null;
  let allRounds = []; // Store ALL rounds from initial load
  let currentRoundIndex = 0; // Track current round (0-indexed)
  let lastUrl = window.location.href;

  function sendCoords(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return;

    const isDifferent = !lastSentCoords || 
        Math.abs(lastSentCoords.lat - lat) > 0.0001 ||
        Math.abs(lastSentCoords.lng - lng) > 0.0001;

    if (!isDifferent) {
      return;
    }

    lastSentCoords = { lat, lng };
    console.log('[CoordX Pro] ✅ SENDING COORDS:', lat, lng, 'via', source);

    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat,
        lng,
        source
      }).catch(() => {});
    } catch (e) {}
  }

  /* ─── GeoGuessr: Store rounds and detect current round ─── */

  function loadAllRoundsFromNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script) return false;

    try {
      const data = JSON.parse(script.textContent);
      const props = data.props?.pageProps;

      if (!props?.gameSnapshot?.rounds) return false;

      const rounds = props.gameSnapshot.rounds;
      const startRound = props.gameSnapshot.round || 1;

      // Store all rounds
      allRounds = rounds.map(r => ({
        lat: r.lat,
        lng: r.lng,
        panoId: r.panoId
      })).filter(r => isValidCoord(r.lat, r.lng));

      currentRoundIndex = startRound - 1; // 0-indexed

      console.log('[CoordX Pro] Loaded', allRounds.length, 'rounds, starting at', startRound);

      // Send first round
      if (allRounds[currentRoundIndex]) {
        sendCoords(allRounds[currentRoundIndex].lat, allRounds[currentRoundIndex].lng, 'geoguessr_init_r' + (currentRoundIndex + 1));
      }

      return true;
    } catch (e) {
      console.warn('[CoordX Pro] Failed to parse __NEXT_DATA__:', e.message);
    }

    return false;
  }

  // Detect round from URL pattern or DOM
  function detectCurrentRound() {
    const url = window.location.href;
    
    // Check URL for round indicator
    const roundMatch = url.match(/round[\/=_](\d+)/i);
    if (roundMatch) {
      return parseInt(roundMatch[1]) - 1; // 0-indexed
    }

    // Check DOM for round counter (GeoGuessr shows "Round 2/5" etc)
    const roundTexts = document.querySelectorAll('[class*="round"], [class*="Round"]');
    for (const el of roundTexts) {
      const text = el.textContent || el.innerText;
      const match = text.match(/(\d+)\s*[\/\|]\s*\d+/);
      if (match) {
        return parseInt(match[1]) - 1; // 0-indexed
      }
    }

    // Check for round indicator in any visible text
    const bodyText = document.body?.innerText || '';
    const bodyMatch = bodyText.match(/round\s*(\d+)/i);
    if (bodyMatch) {
      return parseInt(bodyMatch[1]) - 1;
    }

    return currentRoundIndex; // Keep current if can't detect
  }

  // Check and send coords for current round
  function checkAndSendCurrentRound() {
    if (allRounds.length === 0) {
      loadAllRoundsFromNextData();
      return;
    }

    const detectedRound = detectCurrentRound();
    
    if (detectedRound !== currentRoundIndex && detectedRound >= 0 && detectedRound < allRounds.length) {
      console.log('[CoordX Pro] Round changed:', currentRoundIndex + 1, '->', detectedRound + 1);
      currentRoundIndex = detectedRound;
      lastSentCoords = null; // Reset to allow new coords
    }

    // Send current round coords
    if (allRounds[currentRoundIndex]) {
      sendCoords(
        allRounds[currentRoundIndex].lat, 
        allRounds[currentRoundIndex].lng, 
        'geoguessr_r' + (currentRoundIndex + 1)
      );
    }
  }

  /* ─── WorldGuessr: Iframe URL Detection ────────────────── */

  function extractFromIframeSrc(src) {
    if (!src) return null;

    const locationMatch = src.match(/location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (locationMatch) {
      const lat = parseFloat(locationMatch[1]);
      const lng = parseFloat(locationMatch[2]);
      if (isValidCoord(lat, lng)) {
        return { lat, lng };
      }
    }
    return null;
  }

  function findStreetViewIframe() {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.src && (
        iframe.src.includes('google.com/maps') ||
        iframe.src.includes('streetview') ||
        iframe.src.includes('maps.googleapis.com') ||
        iframe.src.includes('location=')
      )) {
        return iframe;
      }
    }
    return null;
  }

  function checkIframe() {
    const iframe = findStreetViewIframe();
    if (iframe && iframe.src) {
      if (lastIframeSrc !== iframe.src) {
        lastIframeSrc = iframe.src;
        const coords = extractFromIframeSrc(iframe.src);
        if (coords) {
          sendCoords(coords.lat, coords.lng, 'worldguessr_iframe');
          return true;
        }
      }
    }
    return false;
  }

  /* ─── Inject Page Script for Network Hooks ────────────── */

  function injectPageScript() {
    const script = document.createElement('script');
    script.id = 'coordx-page-script';

    script.textContent = `
(function() {
  if (window.__coordxPageInjected) return;
  window.__coordxPageInjected = true;

  console.log('[CoordX Pro] Page script v1.2.5 injected');

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source, round) {
    console.log('[CoordX Pro] 📍 Found:', lat, lng, 'round:', round, 'via', source);
    window.dispatchEvent(new CustomEvent('__coordx_coords', {
      detail: { lat, lng, source, round }
    }));
  }

  function processGeoGuessrResponse(data, url) {
    // Check for game state with rounds
    if (data.gameSnapshot) {
      const snapshot = data.gameSnapshot;
      const currentRound = snapshot.round || 1;
      
      // Send current round
      if (snapshot.rounds && snapshot.rounds[currentRound - 1]) {
        const r = snapshot.rounds[currentRound - 1];
        if (isValidCoord(r.lat, r.lng)) {
          sendCoords(r.lat, r.lng, 'api_current', currentRound);
        }
      }
      
      // Also send ALL rounds with their indices
      if (snapshot.rounds) {
        snapshot.rounds.forEach((r, i) => {
          if (isValidCoord(r.lat, r.lng)) {
            sendCoords(r.lat, r.lng, 'api_all', i + 1);
          }
        });
      }
    }
    
    // Direct rounds array
    if (data.rounds && Array.isArray(data.rounds)) {
      data.rounds.forEach((r, i) => {
        if (isValidCoord(r.lat, r.lng)) {
          sendCoords(r.lat, r.lng, 'rounds_array', i + 1);
        }
      });
    }
    
    // Single location
    if (isValidCoord(data.lat, data.lng)) {
      sendCoords(data.lat, data.lng, 'single', null);
    }
  }

  function processResponse(text, url) {
    if (!text) return;
    
    try {
      const data = JSON.parse(text);
      processGeoGuessrResponse(data, url);
    } catch (e) {
      // Regex fallback
      const match = text.match(/"lat"\\s*:\\s*(-?\\d{1,2}\\.\\d{4,})\\s*,\\s*"lng"\\s*:\\s*(-?\\d{1,3}\\.\\d{4,})/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (isValidCoord(lat, lng)) {
          sendCoords(lat, lng, 'regex', null);
        }
      }
    }
  }

  // Hook fetch - check ALL URLs
  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await _fetch.apply(this, arguments);
    
    // Log and process geoguessr calls
    if (url.includes('geoguessr')) {
      console.log('[CoordX Pro] 🔍 Fetch:', url);
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        processResponse(text, url);
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
      if (xhr._coordx_url && xhr._coordx_url.includes('geoguessr')) {
        console.log('[CoordX Pro] 🔍 XHR:', xhr._coordx_url);
        processResponse(xhr.responseText, xhr._coordx_url);
      }
    });
    return _send.apply(this, arguments);
  };

  console.log('[CoordX Pro] ✅ Network hooks installed');
})();
`;

    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  // Listen for coordinates from page script
  window.addEventListener('__coordx_coords', (event) => {
    const { lat, lng, source, round } = event.detail;
    
    // If round is specified and we have allRounds, use it to validate
    if (round && allRounds.length > 0) {
      const roundIdx = round - 1;
      if (roundIdx !== currentRoundIndex && roundIdx < allRounds.length) {
        console.log('[CoordX Pro] API says round', round);
        currentRoundIndex = roundIdx;
        lastSentCoords = null;
      }
    }
    
    sendCoords(lat, lng, source);
  });

  /* ─── Initialization ──────────────────────────────────── */

  function init() {
    console.log('[CoordX Pro] Initializing v1.2.5...');
    injectPageScript();
  }

  function setupObservers() {
    const hostname = window.location.hostname;

    // GeoGuessr setup
    if (hostname.includes('geoguessr.com')) {
      // Load rounds immediately and after delays
      loadAllRoundsFromNextData();
      setTimeout(loadAllRoundsFromNextData, 500);
      setTimeout(loadAllRoundsFromNextData, 1000);
      setTimeout(loadAllRoundsFromNextData, 2000);

      // Check for round changes periodically
      setInterval(checkAndSendCurrentRound, 500);

      // Watch DOM for changes (round indicator might update)
      const observer = new MutationObserver(() => {
        checkAndSendCurrentRound();
      });
      
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }
    }

    // WorldGuessr - Iframe monitoring
    if (hostname.includes('worldguessr.com')) {
      const observer = new MutationObserver(() => {
        checkIframe();
      });
      
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['src']
        });
      }

      setInterval(checkIframe, 500);
    }

    // URL change detection
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('[CoordX Pro] URL changed:', lastUrl);
        lastSentCoords = null;
        currentRoundIndex = 0;
        
        if (hostname.includes('geoguessr.com')) {
          loadAllRoundsFromNextData();
        }
      }
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      setupObservers();
    });
  } else {
    init();
    setupObservers();
  }

})();
