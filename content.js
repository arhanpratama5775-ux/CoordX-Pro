/**
 * CoordX Pro — Content Script (v1.1.0)
 *
 * v1.1.0: Better new round detection for multiplayer
 * WorldGuessr uses an iframe for Street View with coords in the URL!
 * Format: https://www.google.com/maps/embed/v1/streetview?location=LAT,LNG&key=...
 */

(function () {
  'use strict';

  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  console.log('[CoordX Pro] 🚀 Content script v1.1.0 loaded on:', window.location.href);

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
  let currentIframeSrc = null;

  function sendCoords(lat, lng, source) {
    // Always send if coords are different (new round)
    const isDifferent = !lastSentCoords || 
        Math.abs(lastSentCoords.lat - lat) > 0.0001 ||
        Math.abs(lastSentCoords.lng - lng) > 0.0001;

    if (!isDifferent) {
      console.log('[CoordX Pro] Same coords, not sending');
      return;
    }

    lastSentCoords = { lat, lng };
    console.log('[CoordX Pro] ✅ SENDING COORDINATES:', lat, lng, 'via', source);

    window.dispatchEvent(new CustomEvent('__coordx_coords', {
      detail: { lat, lng, source }
    }));
  }

  /**
   * Extract coordinates from Street View iframe URL
   */
  function extractFromIframeSrc(src) {
    if (!src) return null;

    // Match location parameter in Google Maps embed URL
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

  /**
   * Find Street View iframe
   */
  function findStreetViewIframe() {
    const selectors = [
      '#streetview',
      'iframe[src*="google.com/maps"]',
      'iframe[src*="streetview"]',
      'iframe[src*="maps.googleapis.com"]',
      '.streetview iframe',
      'iframe[allow*="streetview"]'
    ];

    for (const selector of selectors) {
      const iframe = document.querySelector(selector);
      if (iframe) {
        return iframe;
      }
    }
    return null;
  }

  /**
   * Check iframe for coordinates - ALWAYS check even if we found coords before
   */
  function checkIframe() {
    const iframe = findStreetViewIframe();
    if (iframe && iframe.src) {
      // Log if iframe src changed
      if (currentIframeSrc !== iframe.src) {
        console.log('[CoordX Pro] 🔄 Iframe src CHANGED!');
        currentIframeSrc = iframe.src;
      }

      const coords = extractFromIframeSrc(iframe.src);
      if (coords) {
        sendCoords(coords.lat, coords.lng, 'iframe_url');
        return true;
      }
    }
    return false;
  }

  /**
   * Watch for iframe changes more aggressively
   */
  function setupIframeObserver() {
    // MutationObserver for DOM changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check for src attribute changes
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          console.log('[CoordX Pro] Iframe src attribute changed');
          checkIframe();
          return;
        }
        // Check for new iframes added
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          checkIframe();
          return;
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });

    // Check every 500ms for iframe URL changes (important for SPA navigation)
    setInterval(checkIframe, 500);

    console.log('[CoordX Pro] Iframe observer active');
  }

  /**
   * Inject page script to hook fetch/XHR
   */
  function injectPageScript() {
    const script = document.createElement('script');
    script.id = 'coordx-page-script';

    script.textContent = `
(function() {
  if (window.__coordxPageInjected) return;
  window.__coordxPageInjected = true;

  console.log('[CoordX Pro] Page script v1.1.0 injected');

  let lastFoundCoords = null;

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source) {
    // Check if coords are significantly different (new round)
    const isDifferent = !lastFoundCoords ||
        Math.abs(lastFoundCoords.lat - lat) > 0.0001 ||
        Math.abs(lastFoundCoords.lng - lng) > 0.0001;

    if (!isDifferent) return;

    lastFoundCoords = { lat, lng };
    console.log('[CoordX Pro] ✅ Found coords via', source, ':', lat, lng);
    window.dispatchEvent(new CustomEvent('__coordx_coords', {
      detail: { lat, lng, source }
    }));
  }

  function parseCoords(text) {
    if (!text) return null;

    // Try to find [lat, lng] pattern
    const bracketMatch = text.match(/\\[\\s*(-?\\d{1,2}\\.\\d{3,})\\s*,\\s*(-?\\d{1,3}\\.\\d{3,})\\s*\\]/);
    if (bracketMatch) {
      const lat = parseFloat(bracketMatch[1]);
      const lng = parseFloat(bracketMatch[2]);
      if (isValidCoord(lat, lng)) return { lat, lng };
    }

    // Try JSON parse
    try {
      const data = JSON.parse(text);
      const find = (obj, depth = 0) => {
        if (depth > 10 || !obj) return null;
        if (Array.isArray(obj)) {
          if (obj.length >= 2 && typeof obj[0] === 'number' && typeof obj[1] === 'number') {
            if (isValidCoord(obj[0], obj[1])) return { lat: obj[0], lng: obj[1] };
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
          for (const v of Object.values(obj)) {
            const r = find(v, depth + 1);
            if (r) return r;
          }
        }
        return null;
      };
      return find(data);
    } catch {}
    return null;
  }

  // Hook fetch
  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    const response = await _fetch.apply(this, arguments);
    try {
      const cloned = response.clone();
      const text = await cloned.text();
      const coords = parseCoords(text);
      if (coords) sendCoords(coords.lat, coords.lng, 'fetch');
    } catch {}
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
        const coords = parseCoords(xhr.responseText);
        if (coords) sendCoords(coords.lat, coords.lng, 'xhr');
      } catch {}
    });
    return _send.apply(this, arguments);
  };

  console.log('[CoordX Pro] Fetch/XHR hooks installed');
})();
`;

    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  // Inject page script
  injectPageScript();

  // Listen for coordinates from page script
  window.addEventListener('__coordx_coords', (event) => {
    const { lat, lng, source } = event.detail;
    console.log(`[CoordX Pro] 📍 Received coords from page:`, lat, lng, 'via', source);

    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat,
        lng,
        source
      }).catch(() => {});
    } catch {}
  });

  // Initialize
  function init() {
    console.log('[CoordX Pro] Initializing...');
    checkIframe();
    setupIframeObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Delayed checks for slow-loading iframes
  setTimeout(init, 500);
  setTimeout(init, 1000);
  setTimeout(init, 2000);
  setTimeout(init, 3000);

})();
