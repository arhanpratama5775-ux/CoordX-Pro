/**
 * CoordX Pro — Main World Script (v1.8.6)
 * 
 * No spam logging, only important events
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.6');

  function sendCoords(lat, lng, source) {
    window.postMessage({
      type: 'COORDX_COORDS',
      lat: lat,
      lng: lng,
      source: source
    }, '*');
  }

  function sendLog(msg) {
    window.postMessage({
      type: 'COORDX_LOG',
      message: msg
    }, '*');
  }

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0);
  }

  // Track panorama instances (use WeakSet to avoid memory leaks)
  const panoramas = new WeakSet();
  let googleMapsHooked = false;

  // Hook Google Maps StreetViewPanorama
  function hookGoogleMaps() {
    if (!window.google?.maps || googleMapsHooked) return;

    const maps = window.google.maps;
    if (!maps.StreetViewPanorama) return;

    const OriginalPanorama = maps.StreetViewPanorama;
    const self = this;
    
    maps.StreetViewPanorama = function(container, opts) {
      const panorama = new OriginalPanorama(container, opts);
      
      if (!panoramas.has(panorama)) {
        panoramas.add(panorama);
        sendLog('Panorama created');
        
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
      }
      
      return panorama;
    };
    maps.StreetViewPanorama.prototype = OriginalPanorama.prototype;
    
    googleMapsHooked = true;
    sendLog('Google Maps hooked');
  }

  // Poll panorama positions - only send if changed significantly
  let lastPolledLat = null;
  let lastPolledLng = null;

  function pollPanoramas() {
    // Find panoramas in window
    const candidates = [
      window.panorama,
      window.streetViewPanorama,
      window.sv,
      window.__PANORAMA__
    ];

    for (const pano of candidates) {
      if (pano && typeof pano.getPosition === 'function') {
        try {
          const position = pano.getPosition();
          if (position) {
            const lat = typeof position.lat === 'function' ? position.lat() : position.lat;
            const lng = typeof position.lng === 'function' ? position.lng() : position.lng;
            
            // Only send if significantly different (more than 100m)
            if (lat && lng) {
              if (lastPolledLat === null || lastPolledLng === null ||
                  Math.abs(lat - lastPolledLat) > 0.001 ||
                  Math.abs(lng - lastPolledLng) > 0.001) {
                lastPolledLat = lat;
                lastPolledLng = lng;
                sendCoords(lat, lng, 'poll');
              }
            }
          }
        } catch (e) {}
      }
    }
  }

  // Hook fetch
  function hookFetch() {
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
      const response = await originalFetch.apply(this, arguments);
      
      const urlStr = typeof url === 'string' ? url : url?.url || '';
      
      if (urlStr.includes('geoguessr') && urlStr.includes('/api/')) {
        const clone = response.clone();
        clone.json().then(data => {
          const search = (obj, depth = 0) => {
            if (depth > 10 || !obj || typeof obj !== 'object') return;
            
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
              for (const key in obj) {
                if (key.toLowerCase().includes('round') || 
                    key.toLowerCase().includes('coord') ||
                    key.toLowerCase().includes('location')) {
                  search(obj[key], depth + 1);
                }
              }
            }
          };
          search(data, 0);
        }).catch(() => {});
      }
      
      return response;
    };
  }

  // Try __NEXT_DATA__
  function tryNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script?.textContent) return;

    try {
      const data = JSON.parse(script.textContent);
      const snapshot = data?.props?.pageProps?.gameSnapshot;
      
      if (snapshot?.rounds) {
        let roundIndex = snapshot.round ?? 0;
        const rounds = snapshot.rounds;
        
        if (roundIndex >= rounds.length) roundIndex = rounds.length - 1;
        if (roundIndex < 0) roundIndex = 0;

        const r = rounds[roundIndex];
        if (r && isValidCoord(r.lat, r.lng)) {
          sendCoords(r.lat, r.lng, 'next_data');
        }
      }
    } catch (e) {}
  }

  // Initialize
  hookFetch();
  tryNextData();
  sendLog('Main world ready');

  // Wait for Google Maps
  const checkGoogle = setInterval(() => {
    hookGoogleMaps();
    if (googleMapsHooked) {
      clearInterval(checkGoogle);
    }
  }, 1000);

  // Poll every 2 seconds (not too fast)
  setInterval(pollPanoramas, 2000);

  // Retry after delays
  setTimeout(hookGoogleMaps, 2000);
  setTimeout(hookGoogleMaps, 5000);

})();
