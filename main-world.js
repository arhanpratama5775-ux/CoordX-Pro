/**
 * CoordX Pro — Main World Script
 * 
 * This runs in the MAIN world (page context) via chrome.scripting.executeScript
 * Can access Google Maps, React, and other page globals
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world script loaded');

  function sendCoords(lat, lng, source) {
    window.postMessage({
      type: 'COORDX_COORDS',
      lat: lat,
      lng: lng,
      source: source
    }, '*');
  }

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0);
  }

  // Track panorama instances
  const panoramas = new Set();

  // Hook Google Maps StreetViewPanorama
  function hookGoogleMaps() {
    if (!window.google?.maps) return false;

    const maps = window.google.maps;

    // Hook StreetViewPanorama constructor
    if (maps.StreetViewPanorama) {
      const OriginalPanorama = maps.StreetViewPanorama;
      maps.StreetViewPanorama = function(container, opts) {
        const panorama = new OriginalPanorama(container, opts);
        panoramas.add(panorama);

        // Hook setPosition
        const originalSetPosition = panorama.setPosition;
        panorama.setPosition = function(latLng) {
          if (latLng) {
            const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
            const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
            if (lat && lng) {
              sendCoords(lat, lng, 'setPosition');
            }
          }
          return originalSetPosition.apply(this, arguments);
        };

        return panorama;
      };
      maps.StreetViewPanorama.prototype = OriginalPanorama.prototype;
      console.log('[CoordX Pro] StreetViewPanorama hooked');
      return true;
    }

    return false;
  }

  // Poll panorama positions
  let lastPolledLat = null;
  let lastPolledLng = null;

  function pollPanoramas() {
    for (const panorama of panoramas) {
      try {
        const position = panorama.getPosition();
        if (position) {
          const lat = position.lat();
          const lng = position.lng();
          if (lat && lng && (lat !== lastPolledLat || lng !== lastPolledLng)) {
            lastPolledLat = lat;
            lastPolledLng = lng;
            sendCoords(lat, lng, 'poll');
          }
        }
      } catch (e) {}
    }
  }

  // Hook fetch for API calls
  function hookFetch() {
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
      const response = await originalFetch.apply(this, arguments);
      
      const urlStr = typeof url === 'string' ? url : url?.url || '';
      
      if (urlStr.includes('geoguessr')) {
        const clone = response.clone();
        clone.json().then(data => {
          const search = (obj, depth = 0) => {
            if (depth > 8 || !obj || typeof obj !== 'object') return;
            
            if (isValidCoord(obj.lat, obj.lng)) {
              sendCoords(obj.lat, obj.lng, 'fetch');
              return;
            }
            if (obj.location && isValidCoord(obj.location.lat, obj.location.lng)) {
              sendCoords(obj.location.lat, obj.location.lng, 'fetch');
              return;
            }
            
            if (Array.isArray(obj)) {
              for (const item of obj) search(item, depth + 1);
            } else {
              for (const key in obj) search(obj[key], depth + 1);
            }
          };
          search(data);
        }).catch(() => {});
      }
      
      return response;
    };
    console.log('[CoordX Pro] Fetch hooked');
  }

  // Initialize
  hookFetch();

  // Wait for Google Maps
  const checkGoogle = setInterval(() => {
    if (hookGoogleMaps()) {
      clearInterval(checkGoogle);
      setInterval(pollPanoramas, 1000);
    }
  }, 500);

  // Also try after page load
  setTimeout(() => {
    if (hookGoogleMaps()) {
      setInterval(pollPanoramas, 1000);
    }
  }, 2000);

  console.log('[CoordX Pro] Main world initialized');

})();
