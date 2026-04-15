/**
 * CoordX Pro — Content Script (v1.8.3)
 * 
 * Minimal logging - only new coords
 */

(function () {
  'use strict';

  if (window.__coordxProV183Injected) return;
  window.__coordxProV183Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.8.3 loaded');
  logToBackground('Content v1.8.3 loaded');

  let lastSentLat = null;
  let lastSentLng = null;
  let blockedLat = null;
  let blockedLng = null;
  let blockUntil = 0;

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 &&
      Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return false;

    const now = Date.now();

    // Check if blocked - NO LOG
    if (now < blockUntil && blockedLat !== null && blockedLng !== null) {
      if (Math.abs(lat - blockedLat) < 0.001 && Math.abs(lng - blockedLng) < 0.001) {
        return false;
      }
    }

    // Skip if same as last sent - NO LOG
    if (lastSentLat !== null && lastSentLng !== null) {
      if (Math.abs(lastSentLat - lat) < 0.0001 && Math.abs(lastSentLng - lng) < 0.0001) {
        return false;
      }
    }

    lastSentLat = lat;
    lastSentLng = lng;

    logToBackground('✅ ' + source + ': ' + lat.toFixed(4) + ', ' + lng.toFixed(4));

    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat: lat,
        lng: lng,
        source: source
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Listen for messages from injected script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    const data = event.data;
    if (!data || data.type !== 'COORDX_COORDS') return;

    const { lat, lng, source } = data;
    sendCoords(lat, lng, source);
  });

  // Inject script into MAIN world
  function injectMainScript() {
    const script = document.createElement('script');
    script.textContent = `
(function() {
  if (window.__coordxMain183) return;
  window.__coordxMain183 = true;

  console.log('[CoordX Pro] Main world v1.8.3');

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

  // Track all panorama instances
  const panoramas = new Set();

  // Hook Google Maps API
  function hookGoogleMapsAPI() {
    if (!window.google?.maps) return;

    const maps = window.google.maps;

    // Hook StreetViewPanorama constructor
    if (maps.StreetViewPanorama) {
      const OriginalPanorama = maps.StreetViewPanorama;
      maps.StreetViewPanorama = function(container, opts) {
        const panorama = new OriginalPanorama(container, opts);
        
        // Store reference
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
    }

    console.log('[CoordX Pro] Google Maps hooked');
  }

  // Poll panorama position
  let lastPolledLat = null;
  let lastPolledLng = null;
  
  function pollPanoramaPosition() {
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

  // Hook fetch
  const originalFetch = window.fetch;
  window.fetch = async function(url, options) {
    const response = await originalFetch.apply(this, arguments);
    
    const urlStr = typeof url === 'string' ? url : url?.url || '';
    
    if (urlStr.includes('geoguessr')) {
      const clone = response.clone();
      clone.text().then(text => {
        try {
          const data = JSON.parse(text);
          const search = (obj, path = '', depth = 0) => {
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
              for (let i = 0; i < Math.min(obj.length, 50); i++) {
                search(obj[i], path + '[' + i + ']', depth + 1);
              }
            } else {
              for (const key in obj) {
                search(obj[key], path + '.' + key, depth + 1);
              }
            }
          };
          search(data, '', 0);
        } catch (e) {}
      }).catch(() => {});
    }
    
    return response;
  };

  // Initialize
  setTimeout(() => {
    hookGoogleMapsAPI();
    setInterval(pollPanoramaPosition, 1000);
  }, 500);

  // Try hooking again when Google Maps loads
  const checkGoogle = setInterval(() => {
    if (window.google?.maps) {
      clearInterval(checkGoogle);
      hookGoogleMapsAPI();
    }
  }, 500);

})();
    `;
    
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  // WorldGuessr detection
  function detectWorldGuessr() {
    const url = window.location.href;
    const locMatch = url.match(/[?&]location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (locMatch) {
      return { lat: parseFloat(locMatch[1]), lng: parseFloat(locMatch[2]), source: 'url' };
    }

    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.src && iframe.src.includes('location=')) {
        const match = iframe.src.match(/location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (match) {
          return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), source: 'iframe' };
        }
      }
    }

    return null;
  }

  // Force check listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'forceCheck') {
      lastSentLat = null;
      lastSentLng = null;
      blockedLat = null;
      blockedLng = null;
      blockUntil = 0;
      sendResponse({ success: true });
    }
  });

  // Init
  injectMainScript();

  // Next button - block old coords for 20 seconds
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT') || text.includes('PLAY')) {
      if (lastSentLat !== null && lastSentLng !== null) {
        blockedLat = lastSentLat;
        blockedLng = lastSentLng;
        blockUntil = Date.now() + 20000;
        logToBackground('Block: ' + blockedLat.toFixed(4) + ' for 20s');
      }
      
      lastSentLat = null;
      lastSentLng = null;
    }
  }, true);

})();
