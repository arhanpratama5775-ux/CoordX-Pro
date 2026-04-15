/**
 * CoordX Pro — Content Script (v1.2.4)
 *
 * Supports:
 * - WorldGuessr (iframe URL detection)
 * - GeoGuessr (__NEXT_DATA__ parsing + network hooks)
 */

(function () {
  'use strict';

  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  console.log('[CoordX Pro] 🚀 Content script v1.2.4 loaded on:', window.location.href);

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
  let lastRound = -1;

  function sendCoords(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return;

    const isDifferent = !lastSentCoords || 
        Math.abs(lastSentCoords.lat - lat) > 0.0001 ||
        Math.abs(lastSentCoords.lng - lng) > 0.0001;

    if (!isDifferent) {
      console.log('[CoordX Pro] ⏭️ Same coords, skipping:', lat, lng);
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
    } catch (e) {
      console.error('[CoordX Pro] Send error:', e);
    }
  }

  /* ─── GeoGuessr: Parse __NEXT_DATA__ ───────────────────── */

  function parseAndSendGeoGuessrCoords() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script) {
      console.log('[CoordX Pro] No __NEXT_DATA__ found');
      return false;
    }

    try {
      const data = JSON.parse(script.textContent);
      const props = data.props?.pageProps;

      if (!props?.gameSnapshot) {
        console.log('[CoordX Pro] No gameSnapshot in __NEXT_DATA__');
        return false;
      }

      const snapshot = props.gameSnapshot;
      const rounds = snapshot.rounds;
      const currentRound = snapshot.round || 1; // 1-indexed

      console.log('[CoordX Pro] GeoGuessr - Round', currentRound, 'of', rounds?.length);

      // Check if round changed
      if (currentRound !== lastRound) {
        console.log('[CoordX Pro] Round changed from', lastRound, 'to', currentRound);
        lastRound = currentRound;
        lastSentCoords = null; // Reset to allow new coords
      }

      // Get coordinates for current round
      if (rounds && rounds[currentRound - 1]) {
        const roundData = rounds[currentRound - 1];
        const lat = roundData.lat;
        const lng = roundData.lng;
        
        if (isValidCoord(lat, lng)) {
          console.log('[CoordX Pro] Found coords for round', currentRound, ':', lat, lng);
          sendCoords(lat, lng, 'geoguessr_nextdata_r' + currentRound);
          return true;
        }
      }

    } catch (e) {
      console.warn('[CoordX Pro] Failed to parse __NEXT_DATA__:', e.message);
    }

    return false;
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

  console.log('[CoordX Pro] Page script v1.2.4 injected');

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source) {
    console.log('[CoordX Pro] 📍 Page script sending:', lat, lng, 'via', source);
    window.dispatchEvent(new CustomEvent('__coordx_coords', {
      detail: { lat, lng, source }
    }));
  }

  // Parse GeoGuessr specific data
  function parseGeoGuessrData(data) {
    const results = [];
    
    // gameSnapshot format
    if (data.gameSnapshot) {
      const snapshot = data.gameSnapshot;
      const currentRound = snapshot.round || 1;
      
      if (snapshot.rounds && snapshot.rounds[currentRound - 1]) {
        const r = snapshot.rounds[currentRound - 1];
        if (isValidCoord(r.lat, r.lng)) {
          results.push({ lat: r.lat, lng: r.lng, round: currentRound, source: 'api_round' });
        }
      }
      // All rounds
      if (snapshot.rounds) {
        for (let i = 0; i < snapshot.rounds.length; i++) {
          const r = snapshot.rounds[i];
          if (isValidCoord(r.lat, r.lng)) {
            results.push({ lat: r.lat, lng: r.lng, round: i + 1, source: 'api_all' });
          }
        }
      }
    }
    
    // Direct rounds array
    if (data.rounds && Array.isArray(data.rounds)) {
      for (let i = 0; i < data.rounds.length; i++) {
        const r = data.rounds[i];
        if (isValidCoord(r.lat, r.lng)) {
          results.push({ lat: r.lat, lng: r.lng, round: i + 1, source: 'rounds' });
        }
      }
    }
    
    // Single location
    if (isValidCoord(data.lat, data.lng)) {
      results.push({ lat: data.lat, lng: data.lng, source: 'single' });
    }

    return results;
  }

  function processResponse(text, url) {
    if (!text) return;
    
    try {
      const data = JSON.parse(text);
      const results = parseGeoGuessrData(data);
      
      for (const r of results) {
        sendCoords(r.lat, r.lng, r.source + '_r' + (r.round || ''));
      }
    } catch (e) {
      // Regex fallback
      const match = text.match(/"lat"\\s*:\\s*(-?\\d{1,2}\\.\\d{4,})\\s*,\\s*"lng"\\s*:\\s*(-?\\d{1,3}\\.\\d{4,})/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (isValidCoord(lat, lng)) {
          sendCoords(lat, lng, 'regex');
        }
      }
    }
  }

  // Hook fetch
  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await _fetch.apply(this, arguments);
    
    if (url.includes('geoguessr.com')) {
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
      if (xhr._coordx_url && xhr._coordx_url.includes('geoguessr.com')) {
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
    const { lat, lng, source } = event.detail;
    sendCoords(lat, lng, source);
  });

  /* ─── Initialization ──────────────────────────────────── */

  function init() {
    console.log('[CoordX Pro] Initializing v1.2.4...');
    injectPageScript();
  }

  function setupObservers() {
    const hostname = window.location.hostname;

    // GeoGuessr - Check __NEXT_DATA__ periodically
    if (hostname.includes('geoguessr.com')) {
      // Initial check
      setTimeout(parseAndSendGeoGuessrCoords, 500);
      setTimeout(parseAndSendGeoGuessrCoords, 1000);
      setTimeout(parseAndSendGeoGuessrCoords, 2000);
      
      // Periodic check for round changes
      setInterval(parseAndSendGeoGuessrCoords, 1000);
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

      // Also check periodically
      setInterval(checkIframe, 500);
    }

    // URL change detection (for SPAs)
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('[CoordX Pro] URL changed:', lastUrl);
        lastSentCoords = null;
        lastRound = -1;
        
        // Re-check for GeoGuessr
        if (hostname.includes('geoguessr.com')) {
          setTimeout(parseAndSendGeoGuessrCoords, 500);
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
