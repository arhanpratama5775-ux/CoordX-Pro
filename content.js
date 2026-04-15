/**
 * CoordX Pro — Content Script (v1.6.0)
 * 
 * Inject script into page context to access React/Next.js state
 */

(function () {
  'use strict';

  if (window.__coordxProV160Injected) return;
  window.__coordxProV160Injected = true;

  console.log('[CoordX Pro] Content script v1.6.0 loaded');

  // Inject script into page context
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      let lastCoords = null;
      let lastRound = -1;
      
      function getCoords() {
        // Try __NEXT_DATA__
        const nextData = document.getElementById('__NEXT_DATA__');
        if (nextData) {
          try {
            const data = JSON.parse(nextData.textContent);
            const snapshot = data.props?.pageProps?.gameSnapshot;
            if (snapshot?.rounds) {
              const roundIndex = snapshot.round ?? 0;
              const rounds = snapshot.rounds;
              
              if (roundIndex >= 0 && roundIndex < rounds.length) {
                const r = rounds[roundIndex];
                if (r.lat && r.lng) {
                  return { lat: r.lat, lng: r.lng, round: roundIndex, total: rounds.length };
                }
              }
            }
          } catch(e) {}
        }
        
        // Try window.__RENDER_DATA__ or similar
        if (window.__INITIAL_STATE__) {
          const state = window.__INITIAL_STATE__;
          // Add more patterns as needed
        }
        
        return null;
      }
      
      function checkAndSend() {
        const coords = getCoords();
        if (!coords) return;
        
        // Only send if round changed or coords different
        if (coords.round !== lastRound || !lastCoords || 
            Math.abs(lastCoords.lat - coords.lat) > 0.0001 ||
            Math.abs(lastCoords.lng - coords.lng) > 0.0001) {
          
          lastCoords = { lat: coords.lat, lng: coords.lng };
          lastRound = coords.round;
          
          // Send to extension
          window.postMessage({
            type: 'COORDX_COORDS',
            lat: coords.lat,
            lng: coords.lng,
            round: coords.round + 1,
            total: coords.total
          }, '*');
          
          console.log('[CoordX Pro] Page found:', coords.lat.toFixed(4), coords.lng.toFixed(4), 'Round', coords.round + 1);
        }
      }
      
      // Check on load
      setTimeout(checkAndSend, 100);
      setTimeout(checkAndSend, 500);
      setTimeout(checkAndSend, 1500);
      setTimeout(checkAndSend, 3000);
      
      // Check periodically
      setInterval(checkAndSend, 2000);
      
      // Check on URL change
      let lastUrl = location.href;
      setInterval(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          lastRound = -1; // Reset round tracking
          lastCoords = null;
          setTimeout(checkAndSend, 500);
          setTimeout(checkAndSend, 1500);
        }
      }, 500);
      
      // Check on click (NEXT button)
      document.addEventListener('click', (e) => {
        const text = (e.target.innerText || '').toUpperCase();
        if (text.includes('NEXT')) {
          lastRound = -1; // Force re-check
          setTimeout(checkAndSend, 300);
          setTimeout(checkAndSend, 1000);
        }
      }, true);
      
      console.log('[CoordX Pro] Page script injected');
    })();
  `;
  
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  // Listen for messages from page script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== 'COORDX_COORDS') return;
    
    const { lat, lng, round, total } = event.data;
    
    console.log('[CoordX Pro] Received from page:', lat.toFixed(4), lng.toFixed(4), 'Round', round);
    
    // Send to background
    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat, lng,
        source: `page_round_${round}`
      });
    } catch (e) {}
  });

})();
