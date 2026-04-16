/**
 * CoordX Pro — Content Script (v1.8.39)
 *
 * GeoGuessr only - handle coords from main world
 * Support: Single Player, Challenge, Multiplayer/Duels
 *
 * Round Detection v2 - Support all game modes
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
  let lastHash = window.location.hash;

  // Cooldown to prevent multiple triggers
  let lastRoundChangeTime = 0;
  const ROUND_CHANGE_COOLDOWN = 2000; // 2 seconds

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
    const now = Date.now();

    // Cooldown check - prevent multiple triggers
    if (now - lastRoundChangeTime < ROUND_CHANGE_COOLDOWN) {
      return;
    }
    lastRoundChangeTime = now;

    // Block old coords
    if (lastSentLat !== null && lastSentLng !== null) {
      blockedLat = lastSentLat;
      blockedLng = lastSentLng;
    }
    lastSentLat = null;
    lastSentLng = null;

    // Log for debugging (can be removed in production)
    console.log('[CoordX] New round detected:', reason);
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

    // Forward debug messages to background
    if (data.type === 'COORDX_DEBUG') {
      try {
        chrome.runtime.sendMessage({
          type: 'debugLog',
          message: data.message,
          data: data.data
        });
      } catch (e) {}
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

    // Handle place guess request - wait for response from main world
    if (message.type === 'placeGuess') {
      // Set up listener for main world response
      const responseHandler = (event) => {
        if (event.source !== window) return;
        if (event.data?.type === 'COORDX_PLACE_RESULT') {
          window.removeEventListener('message', responseHandler);
          sendResponse(event.data);
        }
      };
      window.addEventListener('message', responseHandler);

      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', responseHandler);
        sendResponse({ success: false, error: 'Timeout', debug: 'No response from page' });
      }, 5000);

      // Send request to main world with map state
      window.postMessage({
        type: 'COORDX_PLACE_GUESS',
        lat: message.lat,
        lng: message.lng,
        accuracy: message.accuracy,
        mapCenter: message.mapCenter,
        mapZoom: message.mapZoom
      }, '*');

      return true; // Keep channel open for async response
    }

    return true;
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
  // ROUND DETECTION v2 - Support all game modes
  // =====================================================

  // Method 1: Button-based (Challenge / Single Player)
  // Works for: Single player, Challenge mode
  document.addEventListener('click', (e) => {
    const target = e.target;
    const text = (target?.innerText || '').toUpperCase().trim();
    const parentText = (target?.parentElement?.innerText || '').toUpperCase().trim();
    const ariaLabel = (target?.getAttribute('aria-label') || '').toUpperCase();

    // Next round buttons
    const nextPatterns = ['NEXT', 'PLAY AGAIN', 'CONTINUE', 'START', 'RETRY'];
    const isNextButton = nextPatterns.some(p =>
      text === p ||
      text.includes(p + ' ') ||
      text.startsWith(p) ||
      parentText.includes(p) ||
      ariaLabel.includes(p)
    );

    if (isNextButton) {
      onNewRound('button');
    }
  }, true);

  // Method 2: URL & Hash change detection
  // Works for: Most game modes when URL changes between rounds
  function checkUrlChange() {
    const currentUrl = window.location.href;
    const currentHash = window.location.hash;

    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      onNewRound('url-change');
    }

    // Hash changes often indicate round changes in GeoGuessr
    if (currentHash !== lastHash && currentHash !== '') {
      lastHash = currentHash;
      onNewRound('hash-change');
    }
  }

  // Use MutationObserver for URL detection (SPA navigation)
  // Wait for document.body to be available
  function setupUrlObserver() {
    if (!document.body) {
      setTimeout(setupUrlObserver, 100);
      return;
    }
    const urlObserver = new MutationObserver(checkUrlChange);
    urlObserver.observe(document.body, { subtree: true, childList: true });
  }
  setupUrlObserver();

  // Also poll for hash changes (sometimes MutationObserver misses hash)
  setInterval(checkUrlChange, 500);

  // Method 3: Round indicator detection
  // Works for: Games that show "Round 1/5" or similar
  function detectRoundIndicator() {
    // GeoGuessr specific selectors
    const selectors = [
      '[class*="round-indicator"]',
      '[class*="roundIndicator"]',
      '[class*="game-round"]',
      '[data-qa="round-number"]',
      '[data-qa="round-indicator"]',
      '.round-number',
      '.round-indicator',
      // GeoGuessr specific class patterns
      '[class*="RoundIndicator"]',
      '[class*="GameRound"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;

      const text = el.innerText || el.textContent || '';
      // Match "Round 1", "1/5", "1 of 5", etc.
      const match = text.match(/(\d+)\s*(?:\/|of|out\s*of)/i);
      if (match) {
        const roundNum = parseInt(match[1]);
        if (lastRoundNumber !== null && roundNum !== lastRoundNumber) {
          onNewRound('round-indicator');
        }
        lastRoundNumber = roundNum;
        return;
      }
    }
  }

  setInterval(detectRoundIndicator, 1000);

  // Method 4: Timer countdown detection
  // Works for: Multiplayer, Duels, Battle Royale with time limits
  let lastTimerValue = null;
  let timerReachedZero = false;

  function detectTimerCountdown() {
    // Find timer elements (GeoGuessr specific)
    const timerSelectors = [
      '[class*="timer"]',
      '[class*="Timer"]',
      '[class*="countdown"]',
      '[class*="Countdown"]',
      '[data-qa="timer"]',
      '[data-qa="countdown"]',
      '[class*="time-remaining"]',
      '[class*="timeLeft"]'
    ];

    for (const selector of timerSelectors) {
      const elements = document.querySelectorAll(selector);

      for (const el of elements) {
        // Skip hidden elements
        if (el.offsetParent === null) continue;

        const text = el.innerText?.trim() || '';

        // Match time formats: "0:30", "1:00", "30s", "25", etc.
        const timeMatch = text.match(/(?:(\d+):)?(\d+)/);
        if (timeMatch) {
          const minutes = parseInt(timeMatch[1]) || 0;
          const seconds = parseInt(timeMatch[2]) || 0;
          const totalSeconds = minutes * 60 + seconds;

          // Only process reasonable timer values (0-300 seconds)
          if (totalSeconds <= 300 && totalSeconds >= 0) {
            // Detect when timer reaches zero
            if (totalSeconds === 0 && lastTimerValue !== null && lastTimerValue > 0) {
              timerReachedZero = true;
              // Round ends when timer hits 0
              setTimeout(() => onNewRound('timer-zero'), 800);
            }

            // Detect significant timer jump (new round started with fresh timer)
            if (lastTimerValue !== null) {
              const jump = totalSeconds - lastTimerValue;
              // If timer jumped up by more than 10 seconds, probably new round
              if (jump > 10 && lastTimerValue < 30) {
                onNewRound('timer-reset');
              }
            }

            lastTimerValue = totalSeconds;
            return;
          }
        }
      }
    }

    // Reset if no timer found
    lastTimerValue = null;
  }

  setInterval(detectTimerCountdown, 300);

  // Method 5: Score/Result screen detection
  // Works for: All modes when score screen appears between rounds
  let scoreScreenDetected = false;

  function detectScoreScreen() {
    // Detect score/result screens
    const scorePatterns = [
      '[class*="score-board"]',
      '[class*="ScoreBoard"]',
      '[class*="result-screen"]',
      '[class*="ResultScreen"]',
      '[class*="round-result"]',
      '[class*="RoundResult"]',
      '[data-qa="score"]',
      '[data-qa="result"]',
      '[class*="intermission"]',
      '[class*="Intermission"]'
    ];

    let found = false;
    for (const selector of scorePatterns) {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) {
        found = true;

        // First time detecting score screen = round ended
        if (!scoreScreenDetected) {
          scoreScreenDetected = true;
          onNewRound('score-screen');
        }
        break;
      }
    }

    // Reset when score screen disappears (new round starting)
    if (!found && scoreScreenDetected) {
      scoreScreenDetected = false;
    }
  }

  setInterval(detectScoreScreen, 500);

  // Method 6: Intermission/Between-round detection
  // Works for: Duels, Battle Royale with intermission screens
  let intermissionDetected = false;

  function detectIntermission() {
    // Look for "Next round in X" or similar text
    const allText = document.body?.innerText || '';
    const intermissionPatterns = [
      /next\s*round\s*in/i,
      /round\s*\d+\s*starts/i,
      /get\s*ready/i,
      /starting\s*soon/i,
      /waiting\s*for/i
    ];

    const hasIntermission = intermissionPatterns.some(p => p.test(allText));

    if (hasIntermission && !intermissionDetected) {
      intermissionDetected = true;
      onNewRound('intermission');
    } else if (!hasIntermission) {
      intermissionDetected = false;
    }
  }

  setInterval(detectIntermission, 1000);

  // Method 7: 3-2-1 Go! countdown detection
  // Works for: Some game modes with countdown before round starts
  let countdownDetected = false;
  let lastCountdownValue = null;

  function detectCountdown() {
    // Look for large centered countdown numbers
    const countdownElements = Array.from(document.querySelectorAll('div, span')).filter(el => {
      if (el.offsetParent === null) return false;
      const text = el.innerText?.trim();
      if (!text) return false;

      // Match single digit 0-5 or "GO!"
      if (/^[0-5]$/.test(text) || text.toUpperCase() === 'GO!') {
        // Must be reasonably large (countdown is usually prominent)
        const rect = el.getBoundingClientRect();
        return rect.width > 30 && rect.height > 30;
      }
      return false;
    });

    if (countdownElements.length > 0) {
      const el = countdownElements[0];
      const text = el.innerText?.trim().toUpperCase();

      if (text === 'GO!') {
        // GO! means round just started
        if (countdownDetected) {
          onNewRound('countdown-go');
          countdownDetected = false;
        }
        lastCountdownValue = null;
        return;
      }

      const num = parseInt(text);
      if (!isNaN(num)) {
        if (lastCountdownValue !== null && num < lastCountdownValue) {
          countdownDetected = true;
        }

        // When countdown reaches 0 or 1, new round is starting
        if (countdownDetected && num <= 1) {
          setTimeout(() => onNewRound('countdown-end'), 300);
          countdownDetected = false;
        }

        lastCountdownValue = num;
      }
    } else {
      // Countdown disappeared
      if (countdownDetected) {
        countdownDetected = false;
        lastCountdownValue = null;
      }
    }
  }

  setInterval(detectCountdown, 200);

})();
