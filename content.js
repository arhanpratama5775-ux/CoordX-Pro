/**
 * CoordX Pro — Content Script (v1.8.16)
 * 
 * Fix continuous update issue and better round sync
 */

(function () {
  'use strict';

  if (window.__coordxProV116Injected) return;
  window.__coordxProV116Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.8.16 loaded');
  logToBackground('Content v1.8.16 loaded');

  // Current round index (0-based)
  let currentRoundIndex = 0;
  
  // Track which round we last synced to (prevent repeated syncs)
  let lastSyncedRound = -1;
  
  // Last sent coordinates - PERSIST across checks
  let lastSentLat = null;
  let lastSentLng = null;
  
  // Count of same coords received (for auto-sync)
  let coordReceiveCount = 0;
  let lastReceivedLat = null;
  let lastReceivedLng = null;
  let lastReceivedRound = null;
  
  // Block exact coords after NEXT
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

    // Block EXACT coords only (not nearby)
    if (now < blockUntil && blockedLat !== null && blockedLng !== null) {
      if (Math.abs(lat - blockedLat) < 0.0001 && Math.abs(lng - blockedLng) < 0.0001) {
        return false;
      }
    }

    // Skip if same as last sent - IMPORTANT: this prevents continuous updates
    if (lastSentLat !== null && lastSentLng !== null) {
      if (Math.abs(lastSentLat - lat) < 0.0001 && Math.abs(lastSentLng - lng) < 0.0001) {
        return false;
      }
    }

    lastSentLat = lat;
    lastSentLng = lng;

    logToBackground('✅ SENT: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));

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

  // Listen for messages from main world
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    const data = event.data;
    if (!data) return;

    if (data.type === 'COORDX_COORDS') {
      const { lat, lng, source, roundIndex } = data;
      
      // Track what we're receiving
      if (roundIndex !== null && roundIndex !== undefined) {
        // Check if this is same coords as before
        const isSameCoords = lastReceivedLat !== null && 
          Math.abs(lastReceivedLat - lat) < 0.0001 && 
          Math.abs(lastReceivedLng - lng) < 0.0001 &&
          lastReceivedRound === roundIndex;
        
        if (isSameCoords) {
          coordReceiveCount++;
          
          // Auto-sync after receiving same coords 5+ times
          if (coordReceiveCount >= 5 && roundIndex !== lastSyncedRound) {
            logToBackground('🔄 Auto-sync: r' + currentRoundIndex + ' → r' + roundIndex);
            currentRoundIndex = roundIndex;
            lastSyncedRound = roundIndex;
            // DON'T reset lastSentLat/lng - prevents continuous updates
          }
        } else {
          // Different coords, reset counter
          coordReceiveCount = 1;
          lastReceivedLat = lat;
          lastReceivedLng = lng;
          lastReceivedRound = roundIndex;
        }
        
        // Filter by round
        if (roundIndex !== currentRoundIndex) {
          return; // Silently skip
        }
      }
      
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
      lastSentLat = null;
      lastSentLng = null;
      blockedLat = null;
      blockedLng = null;
      blockUntil = 0;
      currentRoundIndex = 0;
      lastSyncedRound = -1;
      coordReceiveCount = 0;
      requestMainWorldInjection();
      sendResponse({ success: true });
    }
  });

  // Init
  function init() {
    requestMainWorldInjection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setTimeout(init, 500);
  setTimeout(init, 2000);

  // Handle NEXT button click
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT') || text.includes('PLAY')) {
      logToBackground('NEXT clicked');
      
      currentRoundIndex++;
      lastSyncedRound = currentRoundIndex;
      logToBackground('📍 Round: ' + currentRoundIndex);
      
      if (lastSentLat !== null && lastSentLng !== null) {
        blockedLat = lastSentLat;
        blockedLng = lastSentLng;
        blockUntil = Date.now() + 10000;
        logToBackground('Block: ' + blockedLat.toFixed(4));
      }
      
      // Reset for new round
      lastSentLat = null;
      lastSentLng = null;
      coordReceiveCount = 0;
    }
  }, true);

})();
