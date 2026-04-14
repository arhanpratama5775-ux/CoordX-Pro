/**
 * CoordX Pro — Content Script (v1.1.2)
 *
 * SUPER AGGRESSIVE mode for multiplayer new round detection
 * Always sends coordinates when iframe src changes
 */

(function () {
  'use strict';

  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  console.log('[CoordX Pro] 🚀 Content script v1.1.2 AGGRESSIVE mode');

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

  let lastIframeSrc = null;

  function sendCoords(lat, lng, source) {
    console.log('[CoordX Pro] 📍 SENDING:', lat, lng, 'via', source);

    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat,
        lng,
        source
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[CoordX Pro] Send error:', chrome.runtime.lastError.message);
        } else if (response) {
          console.log('[CoordX Pro] Response:', response);
        }
      });
    } catch (e) {
      console.error('[CoordX Pro] Failed to send:', e.message);
    }
  }

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
    // More comprehensive selectors
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
    
    if (!iframe || !iframe.src) {
      return false;
    }

    const coords = extractFromIframeSrc(iframe.src);
    
    if (!coords) {
      return false;
    }

    // ALWAYS send if iframe src changed (new round indicator)
    const srcChanged = lastIframeSrc !== iframe.src;
    
    if (srcChanged) {
      console.log('[CoordX Pro] 🔄 IFRAME SRC CHANGED - NEW ROUND!');
      console.log('[CoordX Pro] Old:', lastIframeSrc?.substring(0, 80));
      console.log('[CoordX Pro] New:', iframe.src.substring(0, 80));
      lastIframeSrc = iframe.src;
      sendCoords(coords.lat, coords.lng, 'iframe_new_round');
      return true;
    }

    return false;
  }

  // Check immediately and frequently
  function aggressiveCheck() {
    checkIframe();
  }

  // Setup multiple monitoring methods
  function init() {
    console.log('[CoordX Pro] Initializing aggressive monitoring...');

    // Method 1: MutationObserver
    const observer = new MutationObserver(() => {
      checkIframe();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });

    // Method 2: Very frequent polling (every 200ms)
    setInterval(aggressiveCheck, 200);

    // Method 3: Check on any click (common for starting new rounds)
    document.addEventListener('click', () => {
      setTimeout(checkIframe, 100);
      setTimeout(checkIframe, 300);
      setTimeout(checkIframe, 500);
    });

    // Initial check
    checkIframe();
    setTimeout(checkIframe, 500);
    setTimeout(checkIframe, 1000);
    setTimeout(checkIframe, 2000);

    console.log('[CoordX Pro] ✅ Aggressive monitoring active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Late init for SPA
  setTimeout(init, 3000);

})();
