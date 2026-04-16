/**
 * CoordX Pro — Content Script (v1.8.31)
 * 
 * GeoGuessr only - handle coords from main world
 * Support: Single Player, Challenge, Multiplayer/Duels
 */

(function () {
  'use strict';

  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  // Coords tracking
  let lastSentLat = null;
  let lastSentLng = null;
  
  // Blocking after round change
  let blockedLat = null;
  let blockedLng = null;
  let blockedCount = 0;

  // Round tracking
  let lastUrl = window.location.href;
  let lastRoundNumber = null;

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
    blockedLat = null;
    blockedLng = null;
    blockedCount = 0;
  }

  function onNewRound(reason) {
    // Block old coords
    if (lastSentLat !== null && lastSentLng !== null) {
      blockedLat = lastSentLat;
      blockedLng = lastSentLng;
    }
    lastSentLat = null;
    lastSentLng = null;
  }

  function sendCoords(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return false;

    // Block old coords after round change
    if (blockedLat !== null && blockedLng !== null) {
      if (Math.abs(lat - blockedLat) < 0.0001 && Math.abs(lng - blockedLng) < 0.0001) {
        blockedCount++;
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
    requestMainWorldInjection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setTimeout(init, 500);
  setTimeout(init, 2000);

  // =====================================================
  // ROUND DETECTION - Support multiple modes
  // =====================================================

  // Method 1: Button-based (Challenge / Single Player)
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    const parentText = (e.target?.parentElement?.innerText || '').toUpperCase();
    
    if (text.includes('NEXT') || text.includes('PLAY') || 
        parentText.includes('NEXT') || parentText.includes('PLAY') ||
        text.includes('CONTINUE') || parentText.includes('CONTINUE')) {
      onNewRound('button');
    }
  }, true);

  // Method 2: URL-based (Multiplayer / Duels / Battle Royale)
  // URL changes when round changes in most modes
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      // Small delay to let the new round load
      setTimeout(() => onNewRound('url'), 100);
    }
  });
  urlObserver.observe(document.body, { subtree: true, childList: true });

  // Method 3: Round indicator detection (for Duels/Battle Royale)
  // Watch for round number changes in UI
  function detectRoundChange() {
    // Try to find round indicator
    const roundIndicators = [
      document.querySelector('[class*="round-indicator"]'),
      document.querySelector('[class*="roundIndicator"]'),
      document.querySelector('[class*="game-round"]'),
      document.querySelector('[data-qa="round-number"]'),
      document.querySelector('.round-number'),
    ].filter(Boolean);

    for (const indicator of roundIndicators) {
      const text = indicator.innerText || indicator.textContent;
      const match = text.match(/(\d+)/);
      if (match) {
        const roundNum = parseInt(match[1]);
        if (lastRoundNumber !== null && roundNum !== lastRoundNumber) {
          onNewRound('indicator');
        }
        lastRoundNumber = roundNum;
        break;
      }
    }
  }

  // Check for round changes periodically
  setInterval(detectRoundChange, 1000);

  // Method 4: Countdown detection (3...2...1...0 pattern)
  // Detect countdown that appears between rounds
  let lastCountdownValue = null;
  let countdownDetected = false;
  
  function detectCountdown() {
    // Look for countdown elements
    const countdownElements = [
      document.querySelector('[class*="countdown"]'),
      document.querySelector('[class*="count-down"]'),
      document.querySelector('[data-qa="countdown"]'),
      document.querySelector('[class*="intermission"]'),
      document.querySelector('[class*="between-round"]'),
      ...Array.from(document.querySelectorAll('div')).filter(el => {
        const text = el.innerText?.trim();
        // Look for standalone numbers 3, 2, 1, 0
        return text && /^[0-3]$/.test(text) && 
               el.offsetWidth > 20 && el.offsetHeight > 20; // Must be visible
      })
    ].filter(Boolean);

    for (const el of countdownElements) {
      const text = el.innerText?.trim();
      const num = parseInt(text);
      
      if (!isNaN(num) && num >= 0 && num <= 3) {
        // Countdown detected
        if (lastCountdownValue !== null) {
          // If countdown went 3->2->1->0 or similar decreasing pattern
          if (num < lastCountdownValue) {
            countdownDetected = true;
          }
          // When countdown reaches 0 or disappears, new round starts
          if (countdownDetected && (num === 0 || num < lastCountdownValue)) {
            if (num === 0) {
              // Wait a bit after countdown ends for new round to load
              setTimeout(() => onNewRound('countdown'), 500);
              countdownDetected = false;
            }
          }
        }
        lastCountdownValue = num;
        return;
      }
    }
    
    // If countdown element disappeared after being detected
    if (countdownDetected && countdownElements.length === 0) {
      setTimeout(() => onNewRound('countdown-disappear'), 300);
      countdownDetected = false;
      lastCountdownValue = null;
    }
  }

  setInterval(detectCountdown, 300);

})();
