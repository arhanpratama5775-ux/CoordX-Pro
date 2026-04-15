/**
 * CoordX Pro — Main World Script (v1.8.5)
 * 
 * More aggressive detection with detailed logging
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

  sendLog('Main world started');

  // Track panorama instances
  const panoramas = new Set();

  // Method 1: Hook Google Maps
  function hookGoogleMaps() {
    if (!window.google?.maps) {
      sendLog('Google Maps not loaded yet');
      return false;
    }

    sendLog('Google Maps found, hooking...');
    const maps = window.google.maps;

    // Hook StreetViewPanorama constructor
    if (maps.StreetViewPanorama) {
      const OriginalPanorama = maps.StreetViewPanorama;
      maps.StreetViewPanorama = function(container, opts) {
        sendLog('StreetViewPanorama created');
        const panorama = new OriginalPanorama(container, opts);
        panoramas.add(panorama);

        // Hook setPosition
        const originalSetPosition = panorama.setPosition;
        panorama.setPosition = function(latLng) {
          if (latLng) {
            const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
            const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
            sendLog('setPosition: ' + lat + ', ' + lng);
            if (lat && lng) {
              sendCoords(lat, lng, 'setPosition');
            }
          }
          return originalSetPosition.apply(this, arguments);
        };

        return panorama;
      };
      maps.StreetViewPanorama.prototype = OriginalPanorama.prototype;
      sendLog('StreetViewPanorama hooked');
      return true;
    } else {
      sendLog('StreetViewPanorama not found');
    }

    return false;
  }

  // Method 2: Find existing panorama in window
  function findExistingPanorama() {
    // Check common places where panorama might be stored
    const places = [
      () => window.panorama,
      () => window.streetViewPanorama,
      () => window.sv,
      () => window.gamePanorama,
      () => window.__PANORAMA__,
    ];

    for (const get of places) {
      try {
        const pano = get();
        if (pano && typeof pano.getPosition === 'function') {
          panoramas.add(pano);
          sendLog('Found panorama in window');
        }
      } catch (e) {}
    }

    // Search in React components
    const elements = document.querySelectorAll('[class*="game"], [class*="panorama"], [class*="street"]');
    for (const el of elements) {
      for (const key in el) {
        if (key.startsWith('__react')) {
          try {
            const fiber = el[key];
            let current = fiber;
            let depth = 0;
            while (current && depth < 30) {
              const state = current.memoizedState || current.stateNode?.state;
              if (state) {
                // Look for panorama
                for (const k in state) {
                  if (state[k] && typeof state[k]?.getPosition === 'function') {
                    panoramas.add(state[k]);
                    sendLog('Found panorama in React state');
                  }
                }
              }
              current = current.return || current.child;
              depth++;
            }
          } catch (e) {}
        }
      }
    }
  }

  // Method 3: Poll panorama positions
  let lastPolledLat = null;
  let lastPolledLng = null;

  function pollPanoramas() {
    for (const panorama of panoramas) {
      try {
        const position = panorama.getPosition();
        if (position) {
          const lat = typeof position.lat === 'function' ? position.lat() : position.lat;
          const lng = typeof position.lng === 'function' ? position.lng() : position.lng;
          if (lat && lng && (lat !== lastPolledLat || lng !== lastPolledLng)) {
            lastPolledLat = lat;
            lastPolledLng = lng;
            sendCoords(lat, lng, 'poll');
          }
        }
      } catch (e) {}
    }
  }

  // Method 4: Hook fetch
  function hookFetch() {
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
      const response = await originalFetch.apply(this, arguments);
      
      const urlStr = typeof url === 'string' ? url : url?.url || '';
      
      if (urlStr.includes('geoguessr')) {
        sendLog('Fetch: ' + urlStr.split('/').slice(-2).join('/'));
        
        const clone = response.clone();
        clone.json().then(data => {
          const search = (obj, path = '', depth = 0) => {
            if (depth > 10 || !obj || typeof obj !== 'object') return;
            
            // Check for lat/lng directly
            if (isValidCoord(obj.lat, obj.lng)) {
              sendLog('Found coords at ' + path);
              sendCoords(obj.lat, obj.lng, 'fetch');
              return;
            }
            // Check for latitude/longitude
            if (isValidCoord(obj.latitude, obj.longitude)) {
              sendCoords(obj.latitude, obj.longitude, 'fetch');
              return;
            }
            // Check for location object
            if (obj.location && isValidCoord(obj.location.lat, obj.location.lng)) {
              sendCoords(obj.location.lat, obj.location.lng, 'fetch');
              return;
            }
            
            if (Array.isArray(obj)) {
              obj.forEach((item, i) => search(item, path + '[' + i + ']', depth + 1));
            } else {
              for (const key in obj) {
                search(obj[key], path + '.' + key, depth + 1);
              }
            }
          };
          search(data, '', 0);
        }).catch(() => {});
      }
      
      return response;
    };
    sendLog('Fetch hooked');
  }

  // Method 5: Try to find __NEXT_DATA__ coords
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
          sendLog('Found in __NEXT_DATA__ round ' + roundIndex);
          sendCoords(r.lat, r.lng, 'next_data');
        }
      }
    } catch (e) {}
  }

  // Initialize
  hookFetch();
  tryNextData();
  findExistingPanorama();

  // Wait for Google Maps
  let hooked = false;
  const checkGoogle = setInterval(() => {
    if (!hooked && hookGoogleMaps()) {
      hooked = true;
      sendLog('Google Maps hooked successfully');
    }
    findExistingPanorama();
  }, 500);

  // Poll panorama positions
  setInterval(pollPanoramas, 1000);

  // Also try after delays
  setTimeout(() => {
    hookGoogleMaps();
    findExistingPanorama();
    tryNextData();
  }, 1000);

  setTimeout(() => {
    hookGoogleMaps();
    findExistingPanorama();
  }, 3000);

  sendLog('Main world initialized');

})();
