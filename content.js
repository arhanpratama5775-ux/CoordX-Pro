/**
 * CoordX Pro — Content Script (v1.2.7)
 *
 * Supports:
 * - WorldGuessr (iframe URL detection)
 * - GeoGuessr (Store rounds + detect "NEXT" button + parse "ROUND X / Y")
 */

(function () {
  'use strict';

  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  console.log('[CoordX Pro] 🚀 Content script v1.2.7 loaded on:', window.location.href);

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

  function sendCoords(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return;

    const isDifferent = !lastSentCoords || 
        Math.abs(lastSentCoords.lat - lat) > 0.0001 ||
        Math.abs(lastSentCoords.lng - lng) > 0.0001;

    if (!isDifferent) return;

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

  function forceSendCoords(lat, lng, source) {
    lastSentCoords = null;
    sendCoords(lat, lng, source);
  }

  /* ─── GeoGuessr: Parse round indicator from DOM ─── */

  function parseRoundIndicator() {
    // Look for "ROUND 1 / 10" or "ROUND 2/5" pattern
    const allText = document.body?.innerText || '';
    const match = allText.match(/ROUND\s*(\d+)\s*[\/\|]\s*(\d+)/i);
    if (match) {
      const current = parseInt(match[1]);
      const total = parseInt(match[2]);
      console.log('[CoordX Pro] 📊 Detected round indicator:', current, '/', total);
      return { current, total };
    }
    return null;
  }

  function getCurrentRoundFromDOM() {
    const indicator = parseRoundIndicator();
    if (indicator) {
      return indicator.current - 1; // 0-indexed
    }
    return currentRoundIndex;
  }

  /* ─── GeoGuessr: Store rounds from __NEXT_DATA__ ─── */

  function loadAllRoundsFromNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script) {
      console.log('[CoordX Pro] No __NEXT_DATA__');
      return false;
    }

    try {
      const data = JSON.parse(script.textContent);
      const props = data.props?.pageProps;

      if (!props?.gameSnapshot?.rounds) {
        console.log('[CoordX Pro] No rounds in gameSnapshot');
        return false;
      }

      const rounds = props.gameSnapshot.rounds;

      // Store all rounds
      allRounds = rounds.map(r => ({
        lat: r.lat,
        lng: r.lng,
        panoId: r.panoId
      })).filter(r => isValidCoord(r.lat, r.lng));

      console.log('[CoordX Pro] ✅ Loaded', allRounds.length, 'rounds');

      // Get current round from DOM indicator
      const domRound = getCurrentRoundFromDOM();
      currentRoundIndex = domRound;
      console.log('[CoordX Pro] Current round from DOM:', currentRoundIndex + 1);

      // Send current round coords
      sendCurrentRound('loaded');

      return true;
    } catch (e) {
      console.warn('[CoordX Pro] Parse error:', e.message);
    }

    return false;
  }

  function sendCurrentRound(source) {
    if (allRounds.length === 0) {
      console.log('[CoordX Pro] No rounds loaded yet');
      return;
    }

    // Also check DOM for current round
    const domRound = getCurrentRoundFromDOM();
    if (domRound !== currentRoundIndex && domRound >= 0 && domRound < allRounds.length) {
      currentRoundIndex = domRound;
    }

    const round = allRounds[currentRoundIndex];
    if (round) {
      console.log('[CoordX Pro] 📍 Sending round', currentRoundIndex + 1, ':', round.lat, round.lng);
      forceSendCoords(round.lat, round.lng, 'geoguessr_' + source + '_r' + (currentRoundIndex + 1));
    }
  }

  function advanceRound() {
    if (currentRoundIndex < allRounds.length - 1) {
      currentRoundIndex++;
      console.log('[CoordX Pro] ➡️ Advanced to round:', currentRoundIndex + 1);
      sendCurrentRound('advanced');
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

  console.log('[CoordX Pro] Page script v1.2.7 injected');

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
    if (data.gameSnapshot) {
      const snapshot = data.gameSnapshot;
      const currentRound = snapshot.round || 1;
      
      if (snapshot.rounds) {
        snapshot.rounds.forEach((r, i) => {
          if (isValidCoord(r.lat, r.lng)) {
            sendCoords(r.lat, r.lng, 'api', i + 1);
          }
        });
      }
      
      if (snapshot.rounds && snapshot.rounds[currentRound - 1]) {
        const r = snapshot.rounds[currentRound - 1];
        if (isValidCoord(r.lat, r.lng)) {
          sendCoords(r.lat, r.lng, 'api_current', currentRound);
        }
      }
    }
    
    if (data.rounds && Array.isArray(data.rounds)) {
      data.rounds.forEach((r, i) => {
        if (isValidCoord(r.lat, r.lng)) {
          sendCoords(r.lat, r.lng, 'rounds', i + 1);
        }
      });
    }
    
    if (isValidCoord(data.lat, data.lng)) {
      sendCoords(data.lat, data.lng, 'single', null);
    }
  }

  function processResponse(text, url) {
    if (!text) return;
    try {
      const data = JSON.parse(text);
      processGeoGuessrResponse(data, url);
    } catch (e) {}
  }

  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await _fetch.apply(this, arguments);
    
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

  window.addEventListener('__coordx_coords', (event) => {
    const { lat, lng, source, round } = event.detail;
    
    if (round && allRounds.length > 0) {
      const roundIdx = round - 1;
      if (roundIdx > currentRoundIndex && roundIdx < allRounds.length) {
        currentRoundIndex = roundIdx;
        forceSendCoords(lat, lng, source + '_r' + round);
        return;
      }
    }
    
    sendCoords(lat, lng, source);
  });

  /* ─── Click Listener for NEXT Button ─────────────────── */

  function setupClickListener() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      const text = (target.innerText || target.textContent || '').toUpperCase().trim();
      const ariaLabel = (target.getAttribute('aria-label') || '').toUpperCase();
      
      // Check for NEXT button specifically
      if (text === 'NEXT' || text.includes('NEXT') || ariaLabel.includes('NEXT')) {
        console.log('[CoordX Pro] 🖱️ NEXT button clicked!');
        
        // Wait for round to change, then send coords
        setTimeout(() => {
          const domRound = getCurrentRoundFromDOM();
          if (domRound !== currentRoundIndex) {
            currentRoundIndex = domRound;
            console.log('[CoordX Pro] Round changed to:', currentRoundIndex + 1);
          } else {
            // Force advance if DOM didn't update yet
            advanceRound();
          }
          sendCurrentRound('next_click');
        }, 300);
        
        setTimeout(() => {
          sendCurrentRound('next_click_delay');
        }, 800);
        
        setTimeout(() => {
          sendCurrentRound('next_click_delay2');
        }, 1500);
      }
    }, true);
  }

  /* ─── Initialization ──────────────────────────────────── */

  function init() {
    console.log('[CoordX Pro] Initializing v1.2.7...');
    injectPageScript();
  }

  function setupObservers() {
    const hostname = window.location.hostname;

    if (hostname.includes('geoguessr.com')) {
      // Load rounds
      loadAllRoundsFromNextData();
      setTimeout(loadAllRoundsFromNextData, 100);
      setTimeout(loadAllRoundsFromNextData, 500);
      setTimeout(loadAllRoundsFromNextData, 1000);

      setupClickListener();

      // Periodically check for round changes from DOM
      setInterval(() => {
        const domRound = getCurrentRoundFromDOM();
        if (domRound !== currentRoundIndex && domRound >= 0 && domRound < allRounds.length) {
          console.log('[CoordX Pro] 🔄 Round changed (detected from DOM):', currentRoundIndex + 1, '->', domRound + 1);
          currentRoundIndex = domRound;
          sendCurrentRound('dom_detect');
        }
      }, 500);

      // Also send current round periodically
      setInterval(() => {
        if (allRounds.length > 0) {
          sendCurrentRound('periodic');
        }
      }, 3000);

      // URL change
      let lastUrl = window.location.href;
      setInterval(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          console.log('[CoordX Pro] URL changed, resetting...');
          allRounds = [];
          currentRoundIndex = 0;
          lastSentCoords = null;
          loadAllRoundsFromNextData();
        }
      }, 300);
    }

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
