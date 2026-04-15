/**
 * CoordX Pro — Content Script (v1.7.0)
 * 
 * Multiple detection methods for maximum compatibility
 */

(function () {
  'use strict';

  if (window.__coordxProV170Injected) return;
  window.__coordxProV170Injected = true;

  console.log('[CoordX Pro] Content script v1.7.0 loaded');

  let lastLat = null;
  let lastLng = null;
  let found = false;

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 &&
      Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source) {
    if (!isValidCoord(lat, lng)) {
      console.log('[CoordX Pro] Invalid coords:', lat, lng);
      return false;
    }
    
    // Skip if same
    if (lastLat !== null && lastLng !== null) {
      if (Math.abs(lastLat - lat) < 0.0001 && Math.abs(lastLng - lng) < 0.0001) {
        return false;
      }
    }
    
    lastLat = lat;
    lastLng = lng;
    found = true;
    
    console.log('[CoordX Pro] ✅ Found:', lat.toFixed(4), lng.toFixed(4), 'via', source);
    
    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat: lat,
        lng: lng,
        source: source
      });
      return true;
    } catch (e) {
      console.error('[CoordX Pro] Send failed:', e);
      return false;
    }
  }

  // Method 1: __NEXT_DATA__
  function method1_NextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script || !script.textContent) return null;
    
    try {
      const data = JSON.parse(script.textContent);
      const snapshot = data.props?.pageProps?.gameSnapshot;
      
      if (!snapshot?.rounds) return null;
      
      const roundIndex = snapshot.round ?? 0;
      const rounds = snapshot.rounds;
      
      if (roundIndex >= 0 && roundIndex < rounds.length) {
        const r = rounds[roundIndex];
        if (r && isValidCoord(r.lat, r.lng)) {
          return { lat: r.lat, lng: r.lng, source: 'next_data' };
        }
      }
    } catch (e) {}
    
    return null;
  }

  // Method 2: Look for location in URL
  function method2_URL() {
    const url = window.location.href;
    
    // Check for location parameter
    const locMatch = url.match(/[?&]location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (locMatch) {
      const lat = parseFloat(locMatch[1]);
      const lng = parseFloat(locMatch[2]);
      if (isValidCoord(lat, lng)) {
        return { lat, lng, source: 'url' };
      }
    }
    
    return null;
  }

  // Method 3: Check iframes (WorldGuessr)
  function method3_Iframe() {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.src && iframe.src.includes('location=')) {
        const match = iframe.src.match(/location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (isValidCoord(lat, lng)) {
            return { lat, lng, source: 'iframe' };
          }
        }
      }
    }
    return null;
  }

  // Method 4: Check window variables
  function method4_Window() {
    // Try common variable names
    const vars = ['__GAME_DATA__', '__INITIAL_STATE__', 'gameData', 'GAME_STATE'];
    for (const v of vars) {
      try {
        const data = window[v];
        if (data && data.lat && data.lng) {
          if (isValidCoord(data.lat, data.lng)) {
            return { lat: data.lat, lng: data.lng, source: 'window_' + v };
          }
        }
      } catch (e) {}
    }
    return null;
  }

  // Try all methods
  function detect() {
    const hostname = window.location.hostname;
    
    // WorldGuessr
    if (hostname.includes('worldguessr.com')) {
      const result = method3_Iframe() || method2_URL();
      if (result) {
        sendCoords(result.lat, result.lng, result.source);
        return true;
      }
      return false;
    }
    
    // GeoGuessr
    if (hostname.includes('geoguessr.com')) {
      const result = method1_NextData();
      if (result) {
        sendCoords(result.lat, result.lng, result.source);
        return true;
      }
      
      // Log that we couldn't find data
      console.log('[CoordX Pro] No data found in __NEXT_DATA__');
      return false;
    }
    
    return false;
  }

  // Listen for force check message
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'forceCheck') {
      lastLat = null;
      lastLng = null;
      detect();
      sendResponse({ success: true });
    }
  });

  // Initial check
  function init() {
    console.log('[CoordX Pro] Running detection...');
    detect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Retry multiple times
  setTimeout(init, 500);
  setTimeout(init, 1500);
  setTimeout(init, 3000);
  setTimeout(init, 5000);

  // Poll every 3 seconds if not found
  setInterval(() => {
    if (!found) {
      detect();
    }
  }, 3000);

  // URL change detection
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      console.log('[CoordX Pro] URL changed');
      lastUrl = location.href;
      lastLat = null;
      lastLng = null;
      found = false;
      setTimeout(init, 300);
      setTimeout(init, 1000);
    }
  }, 500);

  // NEXT button click
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT')) {
      console.log('[CoordX Pro] NEXT clicked');
      lastLat = null;
      lastLng = null;
      found = false;
      setTimeout(init, 300);
      setTimeout(init, 1000);
      setTimeout(init, 2000);
    }
  }, true);

})();
