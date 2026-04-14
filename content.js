/**
 * CoordX Pro — Content Script (v1.0.8)
 *
 * WorldGuessr uses an iframe for Street View with coords in the URL!
 * Format: https://www.google.com/maps/embed/v1/streetview?location=LAT,LNG&key=...
 */

(function () {
  'use strict';

  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  console.log('[CoordX Pro] 🚀 Content script v1.0.8 loaded on:', window.location.href);

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

  let lastFoundCoords = null;

  function sendCoords(lat, lng, source) {
    // Avoid duplicates
    if (lastFoundCoords && 
        Math.abs(lastFoundCoords.lat - lat) < 0.0001 &&
        Math.abs(lastFoundCoords.lng - lng) < 0.0001) {
      return;
    }
    lastFoundCoords = { lat, lng };

    console.log('[CoordX Pro] ✅✅✅ FOUND COORDINATES:', lat, lng, 'via', source);
    
    // Send via CustomEvent to content script listener
    window.dispatchEvent(new CustomEvent('__coordx_coords', {
      detail: { lat, lng, source }
    }));
  }

  /**
   * Extract coordinates from Street View iframe URL
   * URL format: https://www.google.com/maps/embed/v1/streetview?location=LAT,LNG&key=...
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

    // Also try panoid format sometimes used
    // Format: ?panoid=... but location might still be there

    return null;
  }

  /**
   * Find and monitor Street View iframe
   */
  function findStreetViewIframe() {
    // Common iframe IDs and classes used by WorldGuessr and similar
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
   * Check iframe for coordinates
   */
  function checkIframe() {
    const iframe = findStreetViewIframe();
    if (iframe && iframe.src) {
      const coords = extractFromIframeSrc(iframe.src);
      if (coords) {
        sendCoords(coords.lat, coords.lng, 'iframe_url');
        return true;
      }
    }
    return false;
  }

  /**
   * Monitor iframe for changes (new rounds)
   */
  function setupIframeObserver() {
    const observer = new MutationObserver(() => {
      checkIframe();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });

    // Also check periodically (in case src changes without mutation)
    setInterval(checkIframe, 1000);
  }

  /**
   * Inject page script to hook fetch/XHR as backup
   */
  function injectPageScript() {
    const script = document.createElement('script');
    script.id = 'coordx-page-script';

    script.textContent = `
(function() {
  if (window.__coordxPageInjected) return;
  window.__coordxPageInjected = true;

  console.log('[CoordX Pro] Page script injected');

  let lastFoundCoords = null;

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source) {
    if (lastFoundCoords && 
        Math.abs(lastFoundCoords.lat - lat) < 0.0001 &&
        Math.abs(lastFoundCoords.lng - lng) < 0.0001) {
      return;
    }
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
      const result = find(data);
      if (result) return result;
    } catch {}

    return null;
  }

  // Hook fetch
  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await _fetch.apply(this, arguments);
    
    try {
      const cloned = response.clone();
      const text = await cloned.text();
      const coords = parseCoords(text);
      if (coords) {
        sendCoords(coords.lat, coords.lng, 'fetch');
      }
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
    console.log(`[CoordX Pro] 📍 Received coords:`, lat, lng, 'via', source);

    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat,
        lng,
        source
      }).catch(() => {});
    } catch {}
  });

  // Wait for DOM to be ready, then setup iframe monitoring
  function init() {
    console.log('[CoordX Pro] Setting up iframe monitoring...');
    
    // Check immediately
    checkIframe();
    
    // Setup observer for DOM changes
    setupIframeObserver();
    
    console.log('[CoordX Pro] ✅ Iframe monitoring active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also check after a delay (for slow-loading iframes)
  setTimeout(init, 1000);
  setTimeout(init, 3000);

})();
