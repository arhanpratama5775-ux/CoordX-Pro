/**
 * CoordX Pro — Content Script (v1.2.0)
 *
 * Supports:
 * - WorldGuessr (iframe URL detection)
 * - GeoGuessr (__NEXT_DATA__ parsing + network hooks)
 */

(function () {
  'use strict';

  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  console.log('[CoordX Pro] 🚀 Content script v1.2.0 loaded on:', window.location.href);

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
      console.log('[CoordX Pro] No __NEXT_DATA__ found');
      return null;
    }

    try {
      const data = JSON.parse(script.textContent);
      console.log('[CoordX Pro] __NEXT_DATA__ parsed');

      // Check for rounds array (challenge/game mode)
      const props = data.props?.pageProps;
      if (props?.gameSnapshot?.rounds) {
        const rounds = props.gameSnapshot.rounds;
        const currentRound = props.gameSnapshot.round - 1; // round is 1-indexed
        
        if (rounds[currentRound]) {
          const lat = rounds[currentRound].lat;
          const lng = rounds[currentRound].lng;
          if (isValidCoord(lat, lng)) {
            console.log('[CoordX Pro] GeoGuessr coords from __NEXT_DATA__:', lat, lng);
            return { lat, lng };
          }
        }
      }

      // Alternative: check gameSnapshot directly
      if (props?.gameSnapshot?.rounds?.[0]) {
        const lat = props.gameSnapshot.rounds[0].lat;
        const lng = props.gameSnapshot.rounds[0].lng;
        if (isValidCoord(lat, lng)) {
          return { lat, lng };
        }
      }

    } catch (e) {
      console.warn('[CoordX Pro] Failed to parse __NEXT_DATA__:', e.message);
    }

    return null;
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
      const coords = parseGeoGuessrNextData();
      if (coords) {
        sendCoords(coords.lat, coords.lng, 'geoguessr_nextdata');
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

  console.log('[CoordX Pro] Page script v1.2.0 injected');

  let lastCoords = null;

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source) {
    if (lastCoords &&
        Math.abs(lastCoords.lat - lat) < 0.0001 &&
        Math.abs(lastCoords.lng - lng) < 0.0001) {
      return;
    }
    lastCoords = { lat, lng };

    console.log('[CoordX Pro] Page script found coords:', lat, lng, 'via', source);
    window.dispatchEvent(new CustomEvent('__coordx_coords', {
      detail: { lat, lng, source }
    }));
  }

  function parseCoordsFromText(text) {
    if (!text) return null;

    // Try JSON parse and find coords
    try {
      const data = JSON.parse(text);
      
      // Look for lat/lng in various formats
      const find = (obj, depth = 0) => {
        if (depth > 15 || !obj) return null;

        if (Array.isArray(obj)) {
          // Look for [lat, lng] pair
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
          // Check for explicit lat/lng keys
          const lat = obj.lat ?? obj.latitude ?? obj.y;
          const lng = obj.lng ?? obj.lon ?? obj.longitude ?? obj.x;
          if (typeof lat === 'number' && typeof lng === 'number' && isValidCoord(lat, lng)) {
            return { lat, lng };
          }
          // Check for location object
          if (obj.location && typeof obj.location === 'object') {
            const locLat = obj.location.lat ?? obj.location.latitude;
            const locLng = obj.location.lng ?? obj.location.lon ?? obj.location.longitude;
            if (typeof locLat === 'number' && typeof locLng === 'number' && isValidCoord(locLat, locLng)) {
              return { lat: locLat, lng: locLng };
            }
          }
          // Recurse
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
      /"lat"\s*:\s*(-?\d{1,2}\.\d{3,})\s*,\s*"lng"\s*:\s*(-?\d{1,3}\.\d{3,})/,
      /"latitude"\s*:\s*(-?\d{1,2}\.\d{3,})\s*,\s*"longitude"\s*:\s*(-?\d{1,3}\.\d{3,})/,
      /\[\s*(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})\s*\]/
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
    
    // Only check relevant URLs
    if (url.includes('geoguessr') || url.includes('google') || url.includes('maps') || url.includes('geo')) {
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        const coords = parseCoordsFromText(text);
        if (coords) {
          sendCoords(coords.lat, coords.lng, 'fetch_' + url.split('?')[0].split('/').pop());
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
        const coords = parseCoordsFromText(xhr.responseText);
        if (coords) sendCoords(coords.lat, coords.lng, 'xhr');
      } catch {}
    });
    return _send.apply(this, arguments);
  };

  console.log('[CoordX Pro] Network hooks installed');
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
    console.log('[CoordX Pro] Initializing...');
    injectPageScript();
    
    // Initial detection
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
        setTimeout(detectCoordinates, 500);
        setTimeout(detectCoordinates, 1000);
      }
    }, 500);

    // Click listener (new rounds often triggered by clicks)
    document.addEventListener('click', () => {
      setTimeout(detectCoordinates, 200);
      setTimeout(detectCoordinates, 500);
    });

    // Periodic check
    setInterval(detectCoordinates, 1000);
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
