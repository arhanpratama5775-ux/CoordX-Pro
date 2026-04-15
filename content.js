/**
 * CoordX Pro — Content Script (v1.2.2)
 *
 * Supports:
 * - WorldGuessr (iframe URL detection)
 * - GeoGuessr (__NEXT_DATA__ parsing + network hooks + round detection)
 */

(function () {
  'use strict';

  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  console.log('[CoordX Pro] 🚀 Content script v1.2.2 loaded on:', window.location.href);

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
  let lastRoundNum = -1; // Track GeoGuessr round changes
  let geoGuessrRounds = null; // Store all rounds data

  function sendCoords(lat, lng, source) {
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

  /* ─── GeoGuessr: Parse __NEXT_DATA__ ───────────────────── */

  function parseGeoGuessrNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script) {
      return null;
    }

    try {
      const data = JSON.parse(script.textContent);
      const props = data.props?.pageProps;

      if (!props?.gameSnapshot) {
        return null;
      }

      const snapshot = props.gameSnapshot;
      const rounds = snapshot.rounds;
      const currentRound = snapshot.round || 1; // 1-indexed

      // Store rounds for later use
      if (rounds && rounds.length > 0) {
        geoGuessrRounds = rounds;
        console.log('[CoordX Pro] GeoGuessr rounds loaded:', rounds.length, 'current round:', currentRound);
      }

      // Get coordinates for current round
      if (rounds && rounds[currentRound - 1]) {
        const roundData = rounds[currentRound - 1];
        const lat = roundData.lat;
        const lng = roundData.lng;
        
        if (isValidCoord(lat, lng)) {
          console.log('[CoordX Pro] GeoGuessr current round', currentRound, 'coords:', lat, lng);
          return { lat, lng, round: currentRound };
        }
      }

      // Fallback: try first round
      if (rounds && rounds[0]) {
        const lat = rounds[0].lat;
        const lng = rounds[0].lng;
        if (isValidCoord(lat, lng)) {
          return { lat, lng, round: 1 };
        }
      }

    } catch (e) {
      console.warn('[CoordX Pro] Failed to parse __NEXT_DATA__:', e.message);
    }

    return null;
  }

  // Check if round changed and send new coords
  function checkGeoGuessrRound() {
    const result = parseGeoGuessrNextData();
    if (result && result.round !== lastRoundNum) {
      console.log('[CoordX Pro] Round changed from', lastRoundNum, 'to', result.round);
      lastRoundNum = result.round;
      lastSentCoords = null; // Reset to allow new coords
      sendCoords(result.lat, result.lng, 'geoguessr_round_' + result.round);
      return true;
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
      const srcChanged = lastIframeSrc !== iframe.src;
      if (srcChanged) {
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

  /* ─── Main Detection Logic ────────────────────────────── */

  function detectCoordinates() {
    const hostname = window.location.hostname;

    // GeoGuessr detection
    if (hostname.includes('geoguessr.com')) {
      if (checkGeoGuessrRound()) {
        return true;
      }
    }

    // WorldGuessr detection
    if (hostname.includes('worldguessr.com')) {
      return checkIframe();
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

  console.log('[CoordX Pro] Page script v1.2.2 injected');

  let lastCoords = null;
  let lastRound = -1;

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source, round) {
    // If round changed, always send
    if (round !== undefined && round !== lastRound) {
      lastRound = round;
      lastCoords = null; // Reset
      console.log('[CoordX Pro] Round changed to', round);
    }

    if (lastCoords &&
        Math.abs(lastCoords.lat - lat) < 0.0001 &&
        Math.abs(lastCoords.lng - lng) < 0.0001) {
      return;
    }
    lastCoords = { lat, lng };

    console.log('[CoordX Pro] Page script found coords:', lat, lng, 'via', source, 'round:', round);
    window.dispatchEvent(new CustomEvent('__coordx_coords', {
      detail: { lat, lng, source, round }
    }));
  }

  // Parse GeoGuessr specific API responses
  function parseGeoGuessrResponse(data, url) {
    // Game snapshot format
    if (data.gameSnapshot) {
      const snapshot = data.gameSnapshot;
      const rounds = snapshot.rounds;
      const currentRound = snapshot.round || 1;

      if (rounds && rounds[currentRound - 1]) {
        const r = rounds[currentRound - 1];
        if (isValidCoord(r.lat, r.lng)) {
          return { lat: r.lat, lng: r.lng, round: currentRound };
        }
      }
    }

    // Direct rounds array
    if (data.rounds && Array.isArray(data.rounds)) {
      const round = data.round || data.currentRound || 1;
      if (data.rounds[round - 1]) {
        const r = data.rounds[round - 1];
        if (isValidCoord(r.lat, r.lng)) {
          return { lat: r.lat, lng: r.lng, round: round };
        }
      }
    }

    // Single round data
    if (data.lat !== undefined && data.lng !== undefined) {
      if (isValidCoord(data.lat, data.lng)) {
        return { lat: data.lat, lng: data.lng };
      }
    }

    return null;
  }

  function parseCoordsFromText(text, url) {
    if (!text) return null;

    try {
      const data = JSON.parse(text);
      
      // First try GeoGuessr specific parsing
      const ggResult = parseGeoGuessrResponse(data, url);
      if (ggResult) return ggResult;
      
      // Generic parsing
      const find = (obj, depth = 0) => {
        if (depth > 15 || !obj) return null;

        if (Array.isArray(obj)) {
          for (let i = 0; i < obj.length - 1; i++) {
            const lat = parseFloat(obj[i]);
            const lng = parseFloat(obj[i + 1]);
            if (isValidCoord(lat, lng)) {
              return { lat, lng };
            }
          }
          for (const item of obj) {
            const r = find(item, depth + 1);
            if (r) return r;
          }
        }

        if (typeof obj === 'object' && obj !== null) {
          const lat = obj.lat ?? obj.latitude ?? obj.y;
          const lng = obj.lng ?? obj.lon ?? obj.longitude ?? obj.x;
          if (typeof lat === 'number' && typeof lng === 'number' && isValidCoord(lat, lng)) {
            return { lat, lng };
          }
          if (obj.location && typeof obj.location === 'object') {
            const locLat = obj.location.lat ?? obj.location.latitude;
            const locLng = obj.location.lng ?? obj.location.lon ?? obj.location.longitude;
            if (typeof locLat === 'number' && typeof locLng === 'number' && isValidCoord(locLat, locLng)) {
              return { lat: locLat, lng: locLng };
            }
          }
          for (const v of Object.values(obj)) {
            const r = find(v, depth + 1);
            if (r) return r;
          }
        }
        return null;
      };

      return find(data);
    } catch {}

    // Regex for coordinate patterns
    const patterns = [
      /"lat"\\s*:\\s*(-?\\d{1,2}\\.\\d{3,})\\s*,\\s*"lng"\\s*:\\s*(-?\\d{1,3}\\.\\d{3,})/,
      /"latitude"\\s*:\\s*(-?\\d{1,2}\\.\\d{3,})\\s*,\\s*"longitude"\\s*:\\s*(-?\\d{1,3}\\.\\d{3,})/,
      /\\[\\s*(-?\\d{1,2}\\.\\d{4,})\\s*,\\s*(-?\\d{1,3}\\.\\d{4,})\\s*\\]/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (isValidCoord(lat, lng)) return { lat, lng };
      }
    }

    return null;
  }

  // Hook fetch
  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await _fetch.apply(this, arguments);
    
    // Check GeoGuessr specific endpoints
    if (url.includes('geoguessr.com') && (
        url.includes('/api/') ||
        url.includes('game-snapshot') ||
        url.includes('games') ||
        url.includes('round')
    )) {
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        const result = parseCoordsFromText(text, url);
        if (result) {
          const source = 'geoguessr_api';
          sendCoords(result.lat, result.lng, source, result.round);
        }
      } catch {}
    }
    // Also check maps/geo related
    else if (url.includes('google') || url.includes('maps') || url.includes('geo')) {
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        const result = parseCoordsFromText(text, url);
        if (result) {
          sendCoords(result.lat, result.lng, 'fetch_' + url.split('?')[0].split('/').pop(), result.round);
        }
      } catch {}
    }
    
    return response;
  };

  // Hook XHR
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    const xhr = this;
    xhr.addEventListener('load', function() {
      try {
        const result = parseCoordsFromText(xhr.responseText, xhr._url);
        if (result) {
          sendCoords(result.lat, result.lng, 'xhr', result.round);
        }
      } catch {}
    });
    return _send.apply(this, arguments);
  };

  // Monitor __NEXT_DATA__ changes for GeoGuessr
  function monitorNextData() {
    const checkNextData = () => {
      const script = document.getElementById('__NEXT_DATA__');
      if (!script) return;

      try {
        const data = JSON.parse(script.textContent);
        const props = data.props?.pageProps;
        if (!props?.gameSnapshot) return;

        const snapshot = props.gameSnapshot;
        const rounds = snapshot.rounds;
        const currentRound = snapshot.round || 1;

        if (rounds && rounds[currentRound - 1]) {
          const r = rounds[currentRound - 1];
          if (isValidCoord(r.lat, r.lng)) {
            sendCoords(r.lat, r.lng, 'nextdata_monitor', currentRound);
          }
        }
      } catch {}
    };

    // Check periodically
    setInterval(checkNextData, 500);
    checkNextData();
  }

  monitorNextData();
  console.log('[CoordX Pro] Network hooks installed');
})();
`;

    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  // Listen for coordinates from page script
  window.addEventListener('__coordx_coords', (event) => {
    const { lat, lng, source, round } = event.detail;
    
    // If round changed, reset lastSentCoords
    if (round !== undefined && round !== lastRoundNum) {
      console.log('[CoordX Pro] Round change detected via page script:', round);
      lastRoundNum = round;
      lastSentCoords = null;
    }
    
    sendCoords(lat, lng, source);
  });

  /* ─── Initialization ──────────────────────────────────── */

  function init() {
    console.log('[CoordX Pro] Initializing...');
    injectPageScript();
    
    // Initial detection with delays
    setTimeout(detectCoordinates, 500);
    setTimeout(detectCoordinates, 1000);
    setTimeout(detectCoordinates, 2000);
    setTimeout(detectCoordinates, 3000);
  }

  // Setup observers
  function setupObservers() {
    // MutationObserver for DOM changes
    const observer = new MutationObserver(() => {
      detectCoordinates();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });

    // URL change detection (for SPAs like GeoGuessr)
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('[CoordX Pro] URL changed, re-detecting...');
        lastSentCoords = null; // Reset to allow new coords
        lastRoundNum = -1; // Reset round tracking
        setTimeout(detectCoordinates, 500);
        setTimeout(detectCoordinates, 1000);
      }
    }, 300);

    // Click listener (new rounds often triggered by clicks)
    document.addEventListener('click', () => {
      setTimeout(detectCoordinates, 200);
      setTimeout(detectCoordinates, 500);
      setTimeout(detectCoordinates, 1000);
    });

    // Periodic check for GeoGuessr round changes
    setInterval(() => {
      const hostname = window.location.hostname;
      if (hostname.includes('geoguessr.com')) {
        checkGeoGuessrRound();
      }
    }, 500);
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
