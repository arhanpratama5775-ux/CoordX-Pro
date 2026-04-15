/**
 * CoordX Pro — Content Script (v1.8.0)
 * 
 * New approach: Intercept API calls and watch DOM
 * __NEXT_DATA__ is static and doesn't update between rounds
 */

(function () {
  'use strict';

  if (window.__coordxProV180Injected) return;
  window.__coordxProV180Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.8.0 loaded');
  logToBackground('Content v1.8.0 loaded');

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

  // Method 1: Try __NEXT_DATA__ (works on initial load)
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

  // Method 2: Intercept fetch/XHR
  function setupNetworkInterceptor() {
    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      
      // Clone to read body
      const clone = response.clone();
      
      try {
        const url = args[0]?.url || args[0] || '';
        
        // Check if it's a GeoGuessr API call
        if (typeof url === 'string' && url.includes('geoguessr.com') && url.includes('/api/')) {
          clone.json().then(data => {
            processApiResponse(url, data);
          }).catch(() => {});
        }
      } catch (e) {}
      
      return response;
    };

    // Intercept XHR
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
      const xhr = new originalXHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;
      
      let url = '';
      
      xhr.open = function(method, u, ...rest) {
        url = u;
        return originalOpen.apply(this, [method, u, ...rest]);
      };
      
      xhr.send = function(...args) {
        xhr.addEventListener('load', function() {
          if (url.includes('geoguessr.com') && url.includes('/api/')) {
            try {
              const data = JSON.parse(xhr.responseText);
              processApiResponse(url, data);
            } catch (e) {}
          }
        });
        return originalSend.apply(this, args);
      };
      
      return xhr;
    };
  }

  // Process API responses
  function processApiResponse(url, data) {
    logToBackground('API: ' + url.split('?')[0].split('/').slice(-2).join('/'));
    
    // Try to extract coords from various API responses
    const coords = extractCoordsFromObject(data);
    if (coords) {
      sendCoords(coords.lat, coords.lng, 'api:' + coords.source);
    }
  }

  // Recursively search for coords in any object
  function extractCoordsFromObject(obj, path = '', depth = 0) {
    if (depth > 5) return null;
    if (!obj || typeof obj !== 'object') return null;

    // Check if this object has lat/lng
    if (isValidCoord(obj.lat, obj.lng)) {
      return { lat: obj.lat, lng: obj.lng, source: path || 'obj' };
    }
    if (isValidCoord(obj.latitude, obj.longitude)) {
      return { lat: obj.latitude, lng: obj.longitude, source: path || 'obj' };
    }
    if (obj.location && isValidCoord(obj.location.lat, obj.location.lng)) {
      return { lat: obj.location.lat, lng: obj.location.lng, source: path + '.location' };
    }

    // Search in arrays
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const result = extractCoordsFromObject(obj[i], path + '[' + i + ']', depth + 1);
        if (result) return result;
      }
    } else {
      // Search in object properties
      for (const key of Object.keys(obj)) {
        if (key.toLowerCase().includes('round') || 
            key.toLowerCase().includes('location') ||
            key.toLowerCase().includes('coord') ||
            key.toLowerCase().includes('game') ||
            key === 'data') {
          const result = extractCoordsFromObject(obj[key], path + '.' + key, depth + 1);
          if (result) return result;
        }
      }
    }

    return null;
  }

  // Method 3: Watch for Street View panorama changes
  function watchStreetView() {
    // Check for panorama in window
    setInterval(() => {
      try {
        // Try to find panorama in various places
        const sv = window.google?.maps?.StreetViewPanorama;
        if (sv) {
          // Try to get position from panorama instances
          const panoramas = document.querySelectorAll('[style*="position"]');
          // This is a long shot, but worth trying
        }
      } catch (e) {}
    }, 1000);
  }

  // Method 4: Watch URL for changes that might indicate new round
  let lastCheckedUrl = '';
  function watchUrl() {
    if (window.location.href !== lastCheckedUrl) {
      lastCheckedUrl = window.location.href;
      logToBackground('URL: ' + window.location.href);
      
      // Try to extract from URL if possible
      const match = window.location.href.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (isValidCoord(lat, lng)) {
          sendCoords(lat, lng, 'url');
        }
      }
    }
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
      // Try __NEXT_DATA__ first
      const result = tryNextData();
      if (result) {
        sendCoords(result.lat, result.lng, result.source);
      }
    }
  }

  // Setup network interceptor
  setupNetworkInterceptor();

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
    detect();
    watchUrl();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setTimeout(init, 500);
  setTimeout(init, 1500);

  // Poll
  setInterval(detect, 1000);
  setInterval(watchUrl, 500);

  // URL change
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      logToBackground('URL changed');
      lastUrl = location.href;
      lastSentLat = null;
      lastSentLng = null;
      setTimeout(detect, 300);
      setTimeout(detect, 1000);
    }
  }, 200);

  // Next button
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT') || text.includes('PLAY')) {
      logToBackground('Button: ' + text);
      
      if (lastSentLat !== null && lastSentLng !== null) {
        blockedLat = lastSentLat;
        blockedLng = lastSentLng;
        blockUntil = Date.now() + 10000;  // 10 seconds
        logToBackground('Block 10s: ' + blockedLat.toFixed(4));
      }
      
      lastSentLat = null;
      lastSentLng = null;
      
      // Extended check schedule
      for (let i = 1; i <= 10; i++) {
        setTimeout(detect, i * 1000);
      }
    }
  }, true);

})();
