/**
 * CoordX Pro — Content Script (v1.8.14)
 * 
 * Content script is the SOURCE OF TRUTH for round index
 * Filters coordinates based on current round
 */

(function () {
  'use strict';

  if (window.__coordxProV114Injected) return;
  window.__coordxProV114Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.8.14 loaded');
  logToBackground('Content v1.8.14 loaded');

  // Current round index - THIS IS THE SOURCE OF TRUTH
  let currentRoundIndex = 0;
  
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

  // Listen for messages from main world
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    const data = event.data;
    if (!data) return;

    if (data.type === 'COORDX_COORDS') {
      const { lat, lng, source, roundIndex } = data;
      
      // If coordinate has a round index, check if it matches current round
      if (roundIndex !== null && roundIndex !== undefined) {
        if (roundIndex !== currentRoundIndex) {
          // Skip coordinates from other rounds - log for debug
          logToBackground('⏭️ Skip round ' + roundIndex + ' (current: ' + currentRoundIndex + ')');
          return;
        }
        logToBackground('✓ Round match! ' + roundIndex + ' = ' + currentRoundIndex);
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

  // Detect round from UI
  function detectRoundFromUI() {
    const roundPatterns = [
      /round\s*(\d+)/i,
      /(\d+)\s*\/\s*\d+/,
      /ronde\s*(\d+)/i
    ];

    const selectors = [
      '[class*="round"]',
      '[class*="Round"]',
      '[data-qa="round-number"]',
      'h1', 'h2', 'h3'
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.innerText || el.textContent;
          if (!text) continue;

          for (const pattern of roundPatterns) {
            const match = text.match(pattern);
            if (match) {
              const roundNum = parseInt(match[1]);
              if (roundNum > 0 && roundNum < 100) {
                return roundNum - 1; // Convert to 0-based index
              }
            }
          }
        }
      } catch (e) {}
    }

    return null;
  }

  // Handle NEXT button click
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT') || text.includes('PLAY')) {
      logToBackground('NEXT clicked');
      
      // Increment round index
      currentRoundIndex++;
      logToBackground('📍 Round index: ' + currentRoundIndex);
      
      if (lastSentLat !== null && lastSentLng !== null) {
        blockedLat = lastSentLat;
        blockedLng = lastSentLng;
        blockUntil = Date.now() + 10000; // 10 seconds
        logToBackground('Block exact: ' + blockedLat.toFixed(4));
      }
      
      // Reset last sent to allow new coords
      lastSentLat = null;
      lastSentLng = null;
    }
  }, true);

  // Periodically detect round from UI (as backup)
  setInterval(() => {
    const uiRound = detectRoundFromUI();
    if (uiRound !== null && uiRound !== currentRoundIndex) {
      currentRoundIndex = uiRound;
      logToBackground('📍 Round from UI: ' + currentRoundIndex);
      lastSentLat = null;
      lastSentLng = null;
    }
  }, 1000);

})();
