/**
 * CoordX Pro — Content Script (v1.8.22)
 * 
 * Block old coords forever, accept new coords
 * Reset on URL/game change
 */

(function () {
  'use strict';

  if (window.__coordxProV122Injected) return;
  window.__coordxProV122Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.8.22 loaded');
  logToBackground('Content v1.8.22 loaded');

  // Current game domain
  let currentGame = null;
  
  function detectGame() {
    const host = window.location.hostname;
    if (host.includes('geoguessr')) return 'geoguessr';
    if (host.includes('worldguessr')) return 'worldguessr';
    if (host.includes('openguessr')) return 'openguessr';
    return 'unknown';
  }
  
  function getGameKey() {
    return 'game_' + detectGame();
  }

  // Last sent coordinates PER GAME
  let lastSentLat = null;
  let lastSentLng = null;
  let lastSentGame = null;
  
  // Blocked coords - FOREVER (until page reload or game change)
  let blockedLat = null;
  let blockedLng = null;
  let blockedGame = null;
  let blockedCount = 0;

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 &&
      Math.abs(lng) > 0.001;
  }

  function resetAll() {
    lastSentLat = null;
    lastSentLng = null;
    lastSentGame = null;
    blockedLat = null;
    blockedLng = null;
    blockedGame = null;
    blockedCount = 0;
    logToBackground('🔄 Full reset - game change detected');
  }

  function sendCoords(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return false;
    
    const game = detectGame();

    // Reset if game changed
    if (lastSentGame !== null && lastSentGame !== game) {
      logToBackground('🎮 Game changed: ' + lastSentGame + ' → ' + game);
      resetAll();
    }
    
    lastSentGame = game;

    // Block old coords - check if same game
    if (blockedLat !== null && blockedLng !== null) {
      // Only block if same game
      if (blockedGame === game) {
        if (Math.abs(lat - blockedLat) < 0.0001 && Math.abs(lng - blockedLng) < 0.0001) {
          blockedCount++;
          logToBackground('🚫 Blocked old coords (x' + blockedCount + ') from ' + game);
          return false;
        }
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

    logToBackground('✅ SENT [' + game + ']: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));

    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat: lat,
        lng: lng,
        source: source + '_' + game
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Listen for messages from main world
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    const data = event.data;
    if (!data) return;

    if (data.type === 'COORDX_COORDS') {
      const { lat, lng, source } = data;
      sendCoords(lat, lng, source);
    }
    
    if (data.type === 'COORDX_LOG') {
      logToBackground('[MW] ' + data.message);
    }
  });

  // Request injection
  function requestMainWorldInjection() {
    chrome.runtime.sendMessage({ type: 'injectMainWorld' });
  }

  // Force check listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'forceCheck') {
      resetAll();
      requestMainWorldInjection();
      sendResponse({ success: true });
    }
  });

  // Init
  function init() {
    currentGame = detectGame();
    logToBackground('🎮 Detected game: ' + currentGame);
    requestMainWorldInjection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setTimeout(init, 500);
  setTimeout(init, 2000);

  // Handle NEXT - block old coords FOREVER
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT') || text.includes('PLAY')) {
      const game = detectGame();
      logToBackground('NEXT clicked on ' + game);
      
      if (lastSentLat !== null && lastSentLng !== null) {
        blockedLat = lastSentLat;
        blockedLng = lastSentLng;
        blockedGame = game;
        logToBackground('🚫 Block forever [' + game + ']: ' + blockedLat.toFixed(4));
      }
      
      lastSentLat = null;
      lastSentLng = null;
    }
  }, true);

  // Watch for URL changes (SPA navigation)
  let lastUrl = window.location.href;
  
  function checkUrlChange() {
    if (window.location.href !== lastUrl) {
      const oldUrl = lastUrl;
      lastUrl = window.location.href;
      logToBackground('🔗 URL changed: ' + oldUrl + ' → ' + lastUrl);
      
      // Check if game changed
      const oldGame = currentGame;
      currentGame = detectGame();
      
      if (oldGame !== currentGame) {
        logToBackground('🎮 Game navigation: ' + oldGame + ' → ' + currentGame);
        resetAll();
      }
    }
  }
  
  setInterval(checkUrlChange, 1000);

})();
