/**
 * CoordX Pro — Content Script (v1.8.15)
 * 
 * Auto-sync round index from incoming coordinates
 */

(function () {
  'use strict';

  if (window.__coordxProV115Injected) return;
  window.__coordxProV115Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.8.15 loaded');
  logToBackground('Content v1.8.15 loaded');

  // Current round index
  let currentRoundIndex = 0;
  
  // Track incoming rounds to auto-sync
  let incomingRoundCounts = {};
  
  // Last sent coordinates
  let lastSentLat = null;
  let lastSentLng = null;
  
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

    // Skip if same as last sent
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
      
      // If coordinate has a round index
      if (roundIndex !== null && roundIndex !== undefined) {
        // Count incoming rounds
        incomingRoundCounts[roundIndex] = (incomingRoundCounts[roundIndex] || 0) + 1;
        
        // Auto-sync: if we receive 3+ coords from same round, assume that's current
        if (incomingRoundCounts[roundIndex] >= 3 && roundIndex !== currentRoundIndex) {
          logToBackground('🔄 Auto-sync round: ' + currentRoundIndex + ' → ' + roundIndex);
          currentRoundIndex = roundIndex;
          lastSentLat = null;  // Reset to allow new coords
          lastSentLng = null;
          incomingRoundCounts = {};  // Reset counts
        }
        
        if (roundIndex !== currentRoundIndex) {
          // Skip coordinates from other rounds
          logToBackground('⏭️ Skip r' + roundIndex + ' (current: r' + currentRoundIndex + ')');
          return;
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
      incomingRoundCounts = {};
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
      logToBackground('📍 Round: ' + currentRoundIndex);
      
      if (lastSentLat !== null && lastSentLng !== null) {
        blockedLat = lastSentLat;
        blockedLng = lastSentLng;
        blockUntil = Date.now() + 10000;
        logToBackground('Block exact: ' + blockedLat.toFixed(4));
      }
      
      lastSentLat = null;
      lastSentLng = null;
      incomingRoundCounts = {};
    }
  }, true);

  // UI detection as backup
  setInterval(() => {
    // Look for round indicator in various formats
    const body = document.body.innerText;
    
    // Pattern: "Round 3", "3 / 5", "Round 3 of 5"
    const patterns = [
      /round\s*(\d+)/i,
      /(\d+)\s*\/\s*\d+\s*$/
    ];
    
    for (const pattern of patterns) {
      const matches = body.match(pattern);
      if (matches) {
        const roundNum = parseInt(matches[1]);
        if (roundNum > 0 && roundNum < 100) {
          const detectedIndex = roundNum - 1;
          if (detectedIndex !== currentRoundIndex) {
            currentRoundIndex = detectedIndex;
            logToBackground('📍 UI round: ' + currentRoundIndex);
            lastSentLat = null;
            lastSentLng = null;
            incomingRoundCounts = {};
          }
          break;
        }
      }
    }
  }, 2000);

})();
