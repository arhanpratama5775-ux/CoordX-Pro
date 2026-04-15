/**
 * CoordX Pro — Content Script (v1.6.2)
 * 
 * NO script injection - direct DOM access only
 */

(function () {
  'use strict';

  if (window.__coordxProV162Injected) return;
  window.__coordxProV162Injected = true;

  console.log('[CoordX Pro] Content script v1.6.2 loaded');

  let lastLat = null;
  let lastLng = null;
  let checkCount = 0;

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
        lat: lat,
        lng: lng,
        source: source
      });
    } catch (e) {
      console.error('[CoordX Pro] Send failed:', e);
    }
  }

  function parseNextData() {
    const script = document.getElementById('__NEXT_DATA__');
    if (!script || !script.textContent) return false;
    
    try {
      const data = JSON.parse(script.textContent);
      const snapshot = data.props?.pageProps?.gameSnapshot;
      
      if (!snapshot?.rounds) return false;
      
      const roundIndex = snapshot.round ?? 0;
      const rounds = snapshot.rounds;
      
      if (roundIndex >= 0 && roundIndex < rounds.length) {
        const r = rounds[roundIndex];
        if (r && isValidCoord(r.lat, r.lng)) {
          sendCoords(r.lat, r.lng, 'next_data_r' + (roundIndex + 1));
          return true;
        }
      }
    } catch (e) {
      console.error('[CoordX Pro] Parse error:', e);
    }
    
    return false;
  }

  function checkWorldGuessr() {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.src && iframe.src.includes('location=')) {
        const match = iframe.src.match(/location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (isValidCoord(lat, lng)) {
            sendCoords(lat, lng, 'worldguessr');
            return true;
          }
        }
      }
    }
    return false;
  }

  function check() {
    checkCount++;
    
    const hostname = window.location.hostname;
    
    if (hostname.includes('geoguessr.com')) {
      parseNextData();
    } else if (hostname.includes('worldguessr.com')) {
      checkWorldGuessr();
    }
  }

  // Initial checks
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check);
  } else {
    check();
  }
  
  setTimeout(check, 500);
  setTimeout(check, 1500);
  setTimeout(check, 3000);

  // Poll every 2 seconds
  setInterval(check, 2000);

  // URL change detection
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastLat = null;
      lastLng = null;
      setTimeout(check, 300);
      setTimeout(check, 1000);
    }
  }, 500);

  // NEXT button click
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT')) {
      console.log('[CoordX Pro] NEXT clicked');
      lastLat = null;
      lastLng = null;
      setTimeout(check, 300);
      setTimeout(check, 1000);
      setTimeout(check, 2000);
    }
  }, true);

})();
