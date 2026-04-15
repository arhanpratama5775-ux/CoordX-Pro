/**
 * CoordX Pro — Main World Script (v1.8.7)
 * 
 * Find EXISTING panoramas and poll their position
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.7');

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

  // Store found panoramas
  const foundPanoramas = new Set();
  let lastLat = null;
  let lastLng = null;
  let lastSource = '';

  // Send coords only if different from last
  function sendIfDifferent(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return;
    
    // Check if significantly different
    if (lastLat !== null && lastLng !== null) {
      if (Math.abs(lat - lastLat) < 0.0001 && Math.abs(lng - lastLng) < 0.0001) {
        return; // Same coords
      }
    }
    
    lastLat = lat;
    lastLng = lng;
    lastSource = source;
    sendCoords(lat, lng, source);
  }

  // Find panorama in DOM elements
  function findPanoramaInDOM() {
    const allElements = document.querySelectorAll('*');
    
    for (const el of allElements) {
      // Check common property names
      const props = ['panorama', 'streetViewPanorama', 'sv', 'streetView', '_panorama'];
      
      for (const prop of props) {
        try {
          const pano = el[prop];
          if (pano && typeof pano.getPosition === 'function') {
            if (!foundPanoramas.has(pano)) {
              foundPanoramas.add(pano);
              sendLog('Found panorama in DOM: ' + prop);
            }
          }
        } catch (e) {}
      }
      
      // Check jQuery data
      try {
        if (el.jquery) {
          const data = el.data();
          if (data?.panorama || data?.streetView) {
            const pano = data.panorama || data.streetView;
            if (typeof pano.getPosition === 'function') {
              if (!foundPanoramas.has(pano)) {
                foundPanoramas.add(pano);
                sendLog('Found panorama in jQuery data');
              }
            }
          }
        }
      } catch (e) {}
    }
  }

  // Find panorama in window object
  function findPanoramaInWindow() {
    const searchPaths = [
      ['panorama'],
      ['streetViewPanorama'],
      ['sv'],
      ['streetView'],
      ['game', 'panorama'],
      ['game', 'streetView'],
      ['map', 'streetView'],
      ['google', 'maps', 'Map', 'streetView'],
    ];

    for (const path of searchPaths) {
      try {
        let obj = window;
        for (const key of path) {
          obj = obj[key];
          if (!obj) break;
        }
        
        if (obj && typeof obj.getPosition === 'function') {
          if (!foundPanoramas.has(obj)) {
            foundPanoramas.add(obj);
            sendLog('Found panorama at window.' + path.join('.'));
          }
        }
      } catch (e) {}
    }

    // Also check google.maps instances
    if (window.google?.maps?.Map) {
      // Find all map instances
      const mapDivs = document.querySelectorAll('[class*="map"], [id*="map"]');
      for (const div of mapDivs) {
        for (const key in div) {
          if (key.startsWith('__') || key.startsWith('_')) {
            try {
              const map = div[key];
              if (map && map.getStreetView) {
                const sv = map.getStreetView();
                if (sv && typeof sv.getPosition === 'function') {
                  if (!foundPanoramas.has(sv)) {
                    foundPanoramas.add(sv);
                    sendLog('Found StreetView from Map instance');
                  }
                }
              }
            } catch (e) {}
          }
        }
      }
    }
  }

  // Poll all found panoramas
  function pollPanoramas() {
    for (const pano of foundPanoramas) {
      try {
        const position = pano.getPosition();
        if (position) {
          const lat = typeof position.lat === 'function' ? position.lat() : position.lat;
          const lng = typeof position.lng === 'function' ? position.lng() : position.lng;
          if (lat && lng) {
            sendIfDifferent(lat, lng, 'poll');
          }
        }
      } catch (e) {
        // Panorama might be destroyed
        foundPanoramas.delete(pano);
      }
    }
  }

  // Hook Google Maps for future panoramas
  function hookGoogleMaps() {
    if (!window.google?.maps) return false;

    sendLog('Google Maps available');

    // Hook StreetViewPanorama
    const OriginalPanorama = window.google.maps.StreetViewPanorama;
    if (OriginalPanorama && !OriginalPanorama.__hooked) {
      window.google.maps.StreetViewPanorama = function(container, opts) {
        sendLog('Creating panorama...');
        const panorama = new OriginalPanorama(container, opts);
        foundPanoramas.add(panorama);
        
        // Hook setPosition
        const origSetPos = panorama.setPosition;
        panorama.setPosition = function(latLng) {
          if (latLng) {
            const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
            const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
            sendLog('setPosition: ' + lat?.toFixed(4) + ', ' + lng?.toFixed(4));
            if (lat && lng) {
              sendIfDifferent(lat, lng, 'setPosition');
            }
          }
          return origSetPos.apply(this, arguments);
        };
        
        return panorama;
      };
      window.google.maps.StreetViewPanorama.prototype = OriginalPanorama.prototype;
      window.google.maps.StreetViewPanorama.__hooked = true;
      sendLog('StreetViewPanorama hooked');
    }

    // Also hook Map.getStreetView
    const OriginalMap = window.google.maps.Map;
    if (OriginalMap && !OriginalMap.__hooked) {
      window.google.maps.Map = function(container, opts) {
        const map = new OriginalMap(container, opts);
        
        // Hook getStreetView
        const origGetSV = map.getStreetView;
        map.getStreetView = function() {
          const sv = origGetSV.call(this);
          if (sv && !foundPanoramas.has(sv)) {
            foundPanoramas.add(sv);
            sendLog('Found StreetView via Map.getStreetView');
          }
          return sv;
        };
        
        return map;
      };
      window.google.maps.Map.prototype = OriginalMap.prototype;
      window.google.maps.Map.__hooked = true;
      sendLog('Map hooked');
    }

    return true;
  }

  // Try __NEXT_DATA__ for initial coords
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
          sendLog('Initial coords from __NEXT_DATA__');
          sendIfDifferent(r.lat, r.lng, 'next_data');
        }
      }
    } catch (e) {}
  }

  // Initialize
  sendLog('Main world started');
  tryNextData();
  hookGoogleMaps();
  findPanoramaInWindow();
  findPanoramaInDOM();

  // Poll every second
  setInterval(() => {
    pollPanoramas();
    findPanoramaInWindow();
    findPanoramaInDOM();
  }, 1000);

  // Try hooking again later
  setTimeout(hookGoogleMaps, 1000);
  setTimeout(hookGoogleMaps, 3000);

  sendLog('Main world initialized');

})();
