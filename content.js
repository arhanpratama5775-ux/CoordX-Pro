/**
 * CoordX Pro — Content Script (v1.8.1)
 * 
 * Inject script into MAIN world to access React/Google Maps state
 */

(function () {
  'use strict';

  if (window.__coordxProV181Injected) return;
  window.__coordxProV181Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.8.1 loaded');
  logToBackground('Content v1.8.1 loaded');

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
        const remaining = Math.ceil((blockUntil - now) / 1000);
        logToBackground('Blocked (' + remaining + 's): ' + lat.toFixed(4));
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

  // Listen for messages from injected script (MAIN world)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    const data = event.data;
    if (!data || data.type !== 'COORDX_COORDS') return;

    const { lat, lng, source } = data;
    if (isValidCoord(lat, lng)) {
      sendCoords(lat, lng, source);
    }
  });

  // Inject script into MAIN world
  function injectMainScript() {
    const script = document.createElement('script');
    script.textContent = `
(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world script injected');

  function sendCoords(lat, lng, source) {
    window.postMessage({
      type: 'COORDX_COORDS',
      lat: lat,
      lng: lng,
      source: source
    }, '*');
  }

  // Method 1: Access Google Maps Street View
  function tryStreetView() {
    try {
      // Find Street View panorama
      if (window.google && window.google.maps) {
        // Look for panorama in various places
        const checkPanorama = () => {
          // Try to find panorama instance
          const svPano = document.querySelector('[class*="street"]');
          if (svPano && svPano.__jsaction) {
            // Google Maps stores data in __jsaction
          }
        };

        // Watch for panorama
        setInterval(checkPanorama, 1000);
      }
    } catch (e) {}
  }

  // Method 2: Access React internals
  function tryReactInternals() {
    // React stores state in DOM elements with __reactFiber$ or __reactInternalInstance$
    const findReactProps = (element) => {
      const key = Object.keys(element || {}).find(k => 
        k.startsWith('__reactFiber') || 
        k.startsWith('__reactInternalInstance') ||
        k.startsWith('__reactProps')
      );
      return element?.[key];
    };

    // Search for React components with coords
    const searchReactTree = () => {
      const elements = document.querySelectorAll('[class*="game"], [class*="round"], [class*="map"]');
      
      for (const el of elements) {
        const fiber = findReactProps(el);
        if (!fiber) continue;

        // Try to find coords in React state
        let current = fiber;
        let depth = 0;
        
        while (current && depth < 20) {
          const state = current.memoizedState || current.stateNode?.state;
          if (state) {
            // Check for lat/lng
            if (isValidCoord(state.lat, state.lng)) {
              return { lat: state.lat, lng: state.lng };
            }
            if (state.location && isValidCoord(state.location.lat, state.location.lng)) {
              return { lat: state.location.lat, lng: state.location.lng };
            }
            if (state.position && isValidCoord(state.position.lat, state.position.lng)) {
              return { lat: state.position.lat, lng: state.position.lng };
            }
          }
          
          current = current.return || current.child;
          depth++;
        }
      }
      
      return null;
    };

    function isValidCoord(lat, lng) {
      return !isNaN(lat) && !isNaN(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180 &&
        !(lat === 0 && lng === 0);
    }

    setInterval(() => {
      const result = searchReactTree();
      if (result) {
        sendCoords(result.lat, result.lng, 'react');
      }
    }, 1000);
  }

  // Method 3: Intercept Google Maps API calls
  function interceptGoogleMaps() {
    if (!window.google?.maps) {
      setTimeout(interceptGoogleMaps, 100);
      return;
    }

    // Hook into StreetViewService
    const originalGetPanorama = window.google.maps.StreetViewService?.prototype?.getPanorama;
    if (originalGetPanorama) {
      window.google.maps.StreetViewService.prototype.getPanorama = function(...args) {
        const callback = args[1];
        if (typeof callback === 'function') {
          args[1] = function(result, status) {
            if (result && result.location) {
              const lat = result.location.latLng?.lat();
              const lng = result.location.latLng?.lng();
              if (lat && lng) {
                sendCoords(lat, lng, 'streetview_api');
              }
            }
            return callback(result, status);
          };
        }
        return originalGetPanorama.apply(this, args);
      };
    }

    // Hook into StreetViewPanorama
    const originalSetPosition = window.google.maps.StreetViewPanorama?.prototype?.setPosition;
    if (originalSetPosition) {
      window.google.maps.StreetViewPanorama.prototype.setPosition = function(latLng) {
        const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
        const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
        if (lat && lng) {
          sendCoords(lat, lng, 'panorama_setPosition');
        }
        return originalSetPosition.apply(this, arguments);
      };
    }

    console.log('[CoordX Pro] Google Maps hooks installed');
  }

  // Method 4: Watch __NEXT_DATA__ changes via MutationObserver
  function watchNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script) return;

    let lastContent = script.textContent;
    
    const checkChange = () => {
      if (script.textContent !== lastContent) {
        lastContent = script.textContent;
        console.log('[CoordX Pro] __NEXT_DATA__ changed');
        
        try {
          const data = JSON.parse(script.textContent);
          const snapshot = data?.props?.pageProps?.gameSnapshot;
          if (snapshot?.rounds) {
            const roundIndex = snapshot.round ?? 0;
            const rounds = snapshot.rounds;
            if (roundIndex < rounds.length) {
              const r = rounds[roundIndex];
              if (r && !isNaN(r.lat) && !isNaN(r.lng)) {
                sendCoords(r.lat, r.lng, 'next_data_changed');
              }
            }
          }
        } catch (e) {}
      }
    };

    // Check periodically
    setInterval(checkChange, 500);
    
    // Also observe DOM changes
    const observer = new MutationObserver(checkChange);
    observer.observe(script, { childList: true, characterData: true, subtree: true });
  }

  // Initialize all methods
  tryStreetView();
  tryReactInternals();
  setTimeout(interceptGoogleMaps, 1000);
  watchNextData();

  console.log('[CoordX Pro] Main world script initialized');
})();
    `;
    
    (document.head || document.documentElement).appendChild(script);
    script.remove();
    
    logToBackground('Main script injected');
  }

  // Try __NEXT_DATA__ from content script too
  function tryNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script || !script.textContent) return null;

    try {
      const data = JSON.parse(script.textContent);
      const snapshot = data?.props?.pageProps?.gameSnapshot;
      
      if (!snapshot?.rounds) return null;

      let roundIndex = snapshot.round ?? 0;
      const rounds = snapshot.rounds;
      
      if (roundIndex >= rounds.length) roundIndex = rounds.length - 1;
      if (roundIndex < 0) roundIndex = 0;

      const r = rounds[roundIndex];
      if (!r) return null;

      const lat = r.lat ?? r.latitude;
      const lng = r.lng ?? r.longitude;
      
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'next_data[' + roundIndex + ']' };
      }
    } catch (e) {}
    
    return null;
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

  // Main detect
  function detect() {
    const hostname = window.location.hostname;

    if (hostname.includes('worldguessr.com')) {
      const result = detectWorldGuessr();
      if (result) {
        sendCoords(result.lat, result.lng, result.source);
      }
      return;
    }

    if (hostname.includes('geoguessr.com')) {
      const result = tryNextData();
      if (result) {
        sendCoords(result.lat, result.lng, result.source);
      }
    }
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
      detect();
      sendResponse({ success: true });
    }
  });

  // Init
  function init() {
    injectMainScript();
    detect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setTimeout(init, 500);
  setTimeout(init, 1500);

  // Poll
  setInterval(detect, 2000);

  // Next button
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT') || text.includes('PLAY')) {
      logToBackground('Button: ' + text);
      
      if (lastSentLat !== null && lastSentLng !== null) {
        blockedLat = lastSentLat;
        blockedLng = lastSentLng;
        blockUntil = Date.now() + 15000;
        logToBackground('Block 15s: ' + blockedLat.toFixed(4));
      }
      
      lastSentLat = null;
      lastSentLng = null;
      
      // Extended check
      for (let i = 1; i <= 15; i++) {
        setTimeout(detect, i * 1000);
      }
    }
  }, true);

})();
