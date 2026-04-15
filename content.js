/**
 * CoordX Pro — Content Script (v1.8.2)
 * 
 * Direct access to panorama object + multiple detection methods
 */

(function () {
  'use strict';

  if (window.__coordxProV182Injected) return;
  window.__coordxProV182Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.8.2 loaded');
  logToBackground('Content v1.8.2 loaded');

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

    // Check if blocked
    if (now < blockUntil && blockedLat !== null && blockedLng !== null) {
      if (Math.abs(lat - blockedLat) < 0.001 && Math.abs(lng - blockedLng) < 0.001) {
        return false;
      }
    }

    // Skip if same as last sent
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
  if (window.__coordxMain182) return;
  window.__coordxMain182 = true;

  console.log('[CoordX Pro] Main world v1.8.2');

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

  // Track all panoramas
  const panoramas = new Set();

  // Method 1: Hook Google Maps BEFORE it loads
  function hookGoogleMapsEarly() {
    // Define custom getter for google.maps
    let _google = window.google;
    Object.defineProperty(window, 'google', {
      get: function() { return _google; },
      set: function(val) {
        _google = val;
        if (val && val.maps) {
          console.log('[CoordX Pro] Google Maps loaded, hooking...');
          setTimeout(() => hookGoogleMapsAPI(), 0);
        }
      },
      configurable: true
    });
  }

  // Method 2: Hook Google Maps API methods
  function hookGoogleMapsAPI() {
    if (!window.google?.maps) return;

    const maps = window.google.maps;

    // Hook StreetViewPanorama constructor
    if (maps.StreetViewPanorama) {
      const OriginalPanorama = maps.StreetViewPanorama;
      maps.StreetViewPanorama = function(container, opts) {
        console.log('[CoordX Pro] StreetViewPanorama created');
        const panorama = new OriginalPanorama(container, opts);
        
        // Store reference
        panoramas.add(panorama);

        // Hook setPosition
        const originalSetPosition = panorama.setPosition;
        panorama.setPosition = function(latLng) {
          const lat = typeof latLng?.lat === 'function' ? latLng.lat() : latLng?.lat;
          const lng = typeof latLng?.lng === 'function' ? latLng.lng() : latLng?.lng;
          console.log('[CoordX Pro] setPosition called:', lat, lng);
          if (lat && lng) {
            sendCoords(lat, lng, 'setPosition');
          }
          return originalSetPosition.apply(this, arguments);
        };

        return panorama;
      };
      maps.StreetViewPanorama.prototype = OriginalPanorama.prototype;
    }

    // Hook LatLng
    if (maps.LatLng) {
      const OriginalLatLng = maps.LatLng;
      maps.LatLng = function(lat, lng) {
        const result = new OriginalLatLng(lat, lng);
        const latVal = typeof lat === 'function' ? lat() : lat;
        const lngVal = typeof lng === 'function' ? lng() : lng;
        console.log('[CoordX Pro] LatLng created:', latVal, lngVal);
        // Don't send immediately - might be from old round
        return result;
      };
      maps.LatLng.prototype = OriginalLatLng.prototype;
    }

    console.log('[CoordX Pro] Google Maps hooked');
  }

  // Method 3: Poll panorama position directly
  function pollPanoramaPosition() {
    setInterval(() => {
      for (const panorama of panoramas) {
        try {
          const position = panorama.getPosition();
          if (position) {
            const lat = position.lat();
            const lng = position.lng();
            if (lat && lng) {
              sendCoords(lat, lng, 'poll_panorama');
            }
          }
        } catch (e) {}
      }
    }, 2000);
  }

  // Method 4: Find panorama in DOM
  function findPanoramaInDOM() {
    setInterval(() => {
      // Look for common panorama containers
      const selectors = [
        '.game_panorama',
        '[class*="panorama"]',
        '[class*="street-view"]',
        '#street-view',
        '.street-view-canvas'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          // Check for stored panorama reference
          if (el.__panorama || el._panorama) {
            const pano = el.__panorama || el._panorama;
            const pos = pano.getPosition?.();
            if (pos) {
              sendCoords(pos.lat(), pos.lng(), 'dom_panorama');
            }
          }
        }
      }
    }, 2000);
  }

  // Method 5: Intercept WebSocket messages
  function hookWebSocket() {
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = new OriginalWebSocket(url, protocols);
      
      const originalSend = ws.send;
      ws.send = function(data) {
        return originalSend.apply(this, arguments);
      };

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          // Look for coords in WebSocket messages
          const search = (obj, path = '') => {
            if (!obj || typeof obj !== 'object') return;
            if (isValidCoord(obj.lat, obj.lng)) {
              sendCoords(obj.lat, obj.lng, 'ws' + path);
            }
            for (const key in obj) {
              search(obj[key], path + '.' + key);
            }
          };
          search(data);
        } catch (e) {}
      });

      return ws;
    };
    window.WebSocket.prototype = OriginalWebSocket.prototype;
  }

  // Method 6: Hook fetch for more specific endpoints
  function hookFetch() {
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
      const response = await originalFetch.apply(this, arguments);
      
      const urlStr = typeof url === 'string' ? url : url?.url || '';
      
      if (urlStr.includes('geoguessr')) {
        const clone = response.clone();
        clone.text().then(text => {
          try {
            const data = JSON.parse(text);
            // Deep search for coords
            const search = (obj, path = '', depth = 0) => {
              if (depth > 10 || !obj || typeof obj !== 'object') return;
              
              // Look for coordinate objects
              if (isValidCoord(obj.lat, obj.lng)) {
                sendCoords(obj.lat, obj.lng, 'fetch:' + path);
                return;
              }
              if (isValidCoord(obj.latitude, obj.longitude)) {
                sendCoords(obj.latitude, obj.longitude, 'fetch:' + path);
                return;
              }
              if (obj.location && isValidCoord(obj.location.lat, obj.location.lng)) {
                sendCoords(obj.location.lat, obj.location.lng, 'fetch:' + path + '.location');
                return;
              }
              
              if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length; i++) {
                  search(obj[i], path + '[' + i + ']', depth + 1);
                }
              } else {
                for (const key in obj) {
                  if (key.toLowerCase().includes('round') || 
                      key.toLowerCase().includes('coord') ||
                      key.toLowerCase().includes('location') ||
                      key.toLowerCase().includes('game') ||
                      key === 'data') {
                    search(obj[key], path + '.' + key, depth + 1);
                  }
                }
              }
            };
            search(data, '', 0);
          } catch (e) {}
        }).catch(() => {});
      }
      
      return response;
    };
  }

  // Initialize all hooks
  hookGoogleMapsEarly();
  hookWebSocket();
  hookFetch();
  
  setTimeout(() => {
    hookGoogleMapsAPI();
    pollPanoramaPosition();
    findPanoramaInDOM();
  }, 1000);

  console.log('[CoordX Pro] All hooks installed');
})();
    `;
    
    (document.head || document.documentElement).appendChild(script);
    script.remove();
    
    logToBackground('Main script injected');
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
      logToBackground('Force check');
      lastSentLat = null;
      lastSentLng = null;
      blockedLat = null;
      blockedLng = null;
      blockUntil = 0;
      sendResponse({ success: true });
    }
  });

  // Init
  function init() {
    injectMainScript();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Inject early
  injectMainScript();

  // Next button - block old coords for 20 seconds
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT') || text.includes('PLAY')) {
      logToBackground('NEXT/PLAY clicked');
      
      if (lastSentLat !== null && lastSentLng !== null) {
        blockedLat = lastSentLat;
        blockedLng = lastSentLng;
        blockUntil = Date.now() + 20000;
        logToBackground('Block 20s: ' + blockedLat.toFixed(4));
      }
      
      lastSentLat = null;
      lastSentLng = null;
    }
  }, true);

})();
