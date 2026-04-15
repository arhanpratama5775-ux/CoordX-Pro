/**
 * CoordX Pro — Content Script (v1.8.12)
 * 
 * Track round index and send to main-world
 */

(function () {
  'use strict';

  if (window.__coordxProV186Injected) return;
  window.__coordxProV186Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.8.12 loaded');
  logToBackground('Content v1.8.12 loaded');

  let lastSentLat = null;
  let lastSentLng = null;
  
  // Track current round index
  let currentRoundIndex = 0;
  
  // Block only the exact coords (not nearby)
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

  // Send round index to main-world script
  function sendRoundToMainWorld(roundIndex) {
    window.postMessage({
      type: 'COORDX_ROUND_CHANGE',
      roundIndex: roundIndex
    }, '*');
  }

  function sendCoords(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return false;

    const now = Date.now();

    // Block EXACT coords only (not nearby)
    if (now < blockUntil && blockedLat !== null && blockedLng !== null) {
      if (Math.abs(lat - blockedLat) < 0.0001 && Math.abs(lng - blockedLng) < 0.0001) {
        // Exact same coords blocked
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
      lastSentLat = null;
      lastSentLng = null;
      blockedLat = null;
      blockedLng = null;
      blockUntil = 0;
      currentRoundIndex = 0;
      sendRoundToMainWorld(0);
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

  // Next button - increment round index and block EXACT coords only
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT') || text.includes('PLAY')) {
      logToBackground('NEXT clicked');
      
      // Increment round index
      currentRoundIndex++;
      logToBackground('📍 Round index: ' + currentRoundIndex);
      
      // Send round change to main-world
      sendRoundToMainWorld(currentRoundIndex);
      
      if (lastSentLat !== null && lastSentLng !== null) {
        blockedLat = lastSentLat;
        blockedLng = lastSentLng;
        blockUntil = Date.now() + 10000; // 10 seconds
        logToBackground('Block exact: ' + blockedLat.toFixed(4));
      }
      
      lastSentLat = null;
      lastSentLng = null;
    }
  }, true);

  // Also detect round from UI periodically
  setInterval(() => {
    const uiRound = detectRoundFromUI();
    if (uiRound !== null && uiRound !== currentRoundIndex) {
      currentRoundIndex = uiRound;
      logToBackground('📍 Round detected from UI: ' + currentRoundIndex);
      sendRoundToMainWorld(currentRoundIndex);
    }
  }, 1000);

})();
