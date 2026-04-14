/**
 * CoordX Pro — Content Script
 *
 * Injects a page script to intercept fetch/XHR responses at the page level.
 * This is necessary because Chrome MV3 service workers cannot access response bodies.
 *
 * The content script acts as a bridge between the page script and background worker.
 */

(function () {
  'use strict';

  // Don't inject twice
  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  console.log('[CoordX Pro] Content script loaded');

  /**
   * Inject a script tag into the page to hook into fetch/XHR.
   * This runs in the page context where we can access response bodies.
   */
  const script = document.createElement('script');
  script.textContent = `
(function() {
  // Don't inject twice
  if (window.__coordxPageInjected) return;
  window.__coordxPageInjected = true;

  console.log('[CoordX Pro] Page script injected - hooking fetch/XHR');

  // Patterns that indicate coordinate-related requests
  const GEO_PATTERNS = [
    /GeoPhotoService/,
    /streetviewpixels/,
    /cbk\\d*\\.google\\.com/,
    /geo\\d*\\.ggpht\\.com/,
    /maps\\.googleapis\\.com.*streetview/,
    /maps\\.googleapis\\.com.*photo/,
    /pano/,
    /sv\\/v/,
  ];

  /**
   * Check if URL matches geo patterns
   */
  function isGeoUrl(url) {
    return GEO_PATTERNS.some(pattern => pattern.test(url));
  }

  /**
   * Parse coordinates from various response formats
   */
  function parseCoordinates(data, url) {
    // Strategy 1: Try to extract from URL parameters
    try {
      const urlObj = new URL(url, window.location.origin);
      const lat = parseFloat(urlObj.searchParams.get('lat'));
      const lng = parseFloat(urlObj.searchParams.get('lng'));
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'url_param' };
      }
    } catch (e) {}

    // Strategy 2: Parse as JSON array (Google's typical format)
    try {
      let parsed;

      if (typeof data === 'string') {
        // Try direct parse
        try {
          parsed = JSON.parse(data);
        } catch {
          // Try to find array in response (handles )]}' prefix)
          const arrayMatch = data.match(/\\[[\\s\\S]*\\]/);
          if (arrayMatch) {
            parsed = JSON.parse(arrayMatch[0]);
          }
        }
      } else if (typeof data === 'object') {
        parsed = data;
      }

      if (Array.isArray(parsed)) {
        const result = findCoordsInArray(parsed);
        if (result) {
          return { ...result, source: 'json_array' };
        }
      }
    } catch (e) {}

    // Strategy 3: Regex search for coordinate patterns
    if (typeof data === 'string') {
      // Pattern: numbers that look like coordinates
      // Lat: -90 to 90, Lng: -180 to 180
      const coordPattern = /["']?(-?\\d{1,2}\\.\\d{4,15})["']?[,:\\s]+["']?(-?\\d{1,3}\\.\\d{4,15})["']?/g;
      let match;
      while ((match = coordPattern.exec(data)) !== null) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (isValidCoord(lat, lng)) {
          return { lat, lng, source: 'regex_pattern' };
        }
      }

      // Also try looking for specific patterns like [lat, lng]
      const bracketPattern = /\\[(-?\\d{1,2}\\.\\d+)\\s*,\\s*(-?\\d{1,3}\\.\\d+)\\]/g;
      while ((match = bracketPattern.exec(data)) !== null) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (isValidCoord(lat, lng)) {
          return { lat, lng, source: 'bracket_pattern' };
        }
      }
    }

    return null;
  }

  /**
   * Recursively search for coordinates in array structure
   */
  function findCoordsInArray(arr, depth = 0) {
    if (depth > 8 || !Array.isArray(arr)) return null;

    // Try positions [2] and [3] (Google's typical format)
    if (arr.length >= 4) {
      const lat = parseFloat(arr[2]);
      const lng = parseFloat(arr[3]);
      if (isValidCoord(lat, lng)) {
        return { lat, lng };
      }
    }

    // Try positions [0] and [1] (sometimes used)
    if (arr.length >= 2) {
      const lat = parseFloat(arr[0]);
      const lng = parseFloat(arr[1]);
      if (isValidCoord(lat, lng)) {
        return { lat, lng };
      }
    }

    // Search nested arrays
    for (let i = 0; i < arr.length; i++) {
      if (Array.isArray(arr[i])) {
        const result = findCoordsInArray(arr[i], depth + 1);
        if (result) return result;
      }

      // Try consecutive numbers
      if (i < arr.length - 1) {
        const lat = parseFloat(arr[i]);
        const lng = parseFloat(arr[i + 1]);
        if (isValidCoord(lat, lng)) {
          return { lat, lng };
        }
      }
    }

    return null;
  }

  /**
   * Validate coordinates
   */
  function isValidCoord(lat, lng) {
    return (
      !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0)
    );
  }

  /**
   * Send coordinates to content script via CustomEvent
   */
  function sendCoords(lat, lng, source) {
    window.dispatchEvent(new CustomEvent('__coordx_coords', {
      detail: { lat, lng, source }
    }));
  }

  /**
   * Process response and extract coordinates
   */
  async function processResponse(url, response) {
    if (!isGeoUrl(url)) return;

    try {
      // Clone response so we don't consume the original
      const cloned = response.clone();

      // Try to read as text
      const text = await cloned.text();

      // Parse coordinates
      const coords = parseCoordinates(text, url);

      if (coords) {
        console.log('[CoordX Pro] Found coords:', coords);
        sendCoords(coords.lat, coords.lng, coords.source);
      }
    } catch (e) {
      // Response might not be text (e.g., image)
    }
  }

  /* ─── Hook Fetch ─────────────────────────────────────── */

  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url;

    const response = await originalFetch.apply(this, arguments);

    // Process response asynchronously (don't block the original request)
    if (url) {
      processResponse(url, response).catch(() => {});
    }

    return response;
  };

  /* ─── Hook XMLHttpRequest ─────────────────────────────── */

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this.__coordx_url = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    const xhr = this;

    xhr.addEventListener('load', function() {
      if (xhr.__coordx_url && isGeoUrl(xhr.__coordx_url)) {
        try {
          const response = xhr.responseText;
          const coords = parseCoordinates(response, xhr.__coordx_url);

          if (coords) {
            console.log('[CoordX Pro] Found coords via XHR:', coords);
            sendCoords(coords.lat, coords.lng, coords.source);
          }
        } catch (e) {}
      }
    });

    return originalSend.apply(this, arguments);
  };

  console.log('[CoordX Pro] Fetch/XHR hooks installed');
})();
`;
  document.documentElement.appendChild(script);
  script.remove();

  /**
   * Listen for coordinates from the page script
   */
  window.addEventListener('__coordx_coords', (event) => {
    const { lat, lng, source } = event.detail;

    console.log(`[CoordX Pro] Received coords from ${source}:`, lat, lng);

    // Send to background script
    chrome.runtime.sendMessage({
      type: 'contentCoords',
      lat,
      lng,
      source
    }).catch(err => {
      console.warn('[CoordX Pro] Could not send to background:', err.message);
    });
  });

})();
