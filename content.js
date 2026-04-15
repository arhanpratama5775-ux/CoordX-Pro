/**
 * CoordX Pro — Content Script (v1.6.1)
 * 
 * Simple and reliable approach
 */

(function () {
  'use strict';

  if (window.__coordxProV161Injected) return;
  window.__coordxProV161Injected = true;

  console.log('[CoordX Pro] Content script v1.6.1 loaded');

  let lastLat = null;
  let lastLng = null;

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 &&
      Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return;
    
    // Skip if same
    if (lastLat !== null && lastLng !== null) {
      if (Math.abs(lastLat - lat) < 0.0001 && Math.abs(lastLng - lng) < 0.0001) {
        return;
      }
    }
    
    lastLat = lat;
    lastLng = lng;
    
    console.log('[CoordX Pro] Found:', lat.toFixed(4), lng.toFixed(4), 'via', source);
    
    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat, lng,
        source: source
      });
    } catch (e) {
      console.error('[CoordX Pro] Send failed:', e);
    }
  }

  function parseGame() {
    // Method 1: __NEXT_DATA__
    const script = document.getElementById('__NEXT_DATA__');
    if (script) {
      try {
        const data = JSON.parse(script.textContent);
        const snapshot = data.props?.pageProps?.gameSnapshot;
        
        if (snapshot?.rounds) {
          const roundIndex = snapshot.round ?? 0;
          const rounds = snapshot.rounds;
          
          if (roundIndex >= 0 && roundIndex < rounds.length) {
            const r = rounds[roundIndex];
            if (r.lat && r.lng) {
              sendCoords(r.lat, r.lng, 'next_data_r' + (roundIndex + 1));
              return true;
            }
          }
        }
      } catch (e) {}
    }
    
    // Method 2: Check URL for location params
    const url = window.location.href;
    const locMatch = url.match(/[?&]location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (locMatch) {
      const lat = parseFloat(locMatch[1]);
      const lng = parseFloat(locMatch[2]);
      if (isValidCoord(lat, lng)) {
        sendCoords(lat, lng, 'url');
        return true;
      }
    }
    
    // Method 3: Check for iframes with location
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.src && iframe.src.includes('location=')) {
        const match = iframe.src.match(/location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (isValidCoord(lat, lng)) {
            sendCoords(lat, lng, 'iframe');
            return true;
          }
        }
      }
    }
    
    return false;
  }

  // Initial parse
  function init() {
    parseGame();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Retry on load
  setTimeout(init, 500);
  setTimeout(init, 1500);
  setTimeout(init, 3000);

  // Poll every 2 seconds
  setInterval(parseGame, 2000);

  // On URL change
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastLat = null;  // Reset to allow new coords
      lastLng = null;
      setTimeout(parseGame, 300);
      setTimeout(parseGame, 1000);
    }
  }, 500);

  // On click
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT')) {
      lastLat = null;  // Reset to force send new coords
      lastLng = null;
      setTimeout(parseGame, 300);
      setTimeout(parseGame, 1000);
      setTimeout(parseGame, 2000);
    }
  }, true);

})();
