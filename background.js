/**
 * CoordX Pro — Background Service Worker (v1.3.0)
 * 
 * DUAL APPROACH:
 * 1. Content script for WorldGuessr (iframe detection)
 * 2. webRequest API for GeoGuessr (intercept API calls directly)
 */

/* ─── State ─────────────────────────────────────────────── */

let lastCoords = null;
let trackingEnabled = true;
let allRounds = []; // Store all rounds for GeoGuessr
let currentRoundIndex = 0;

const SUPPORTED_SITES = [
  'geoguessr.com',
  'openguessr.com',
  'worldguessr.com',
  'crazygames.com'
];

/* ─── Side Panel Management ─────────────────────────────── */

function initSidePanel() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(err => console.warn('[CoordX Pro] setPanelBehavior failed:', err));
}

chrome.runtime.onInstalled.addListener(() => {
  initSidePanel();
  chrome.storage.local.set({
    trackingEnabled: true,
    lastCoords: null,
    lastAddress: null
  });
  console.log('[CoordX Pro] Extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  initSidePanel();
});

initSidePanel();

chrome.storage.local.get(['trackingEnabled']).then(result => {
  if (result.trackingEnabled !== undefined) {
    trackingEnabled = result.trackingEnabled;
  }
}).catch(() => {});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isSupported = SUPPORTED_SITES.some(site => tab.url.includes(site));
    if (isSupported) {
      chrome.sidePanel.setOptions({
        tabId,
        path: 'sidepanel.html',
        enabled: true
      }).catch(() => {});
    }
  }
});

/* ─── Helper Functions ─────────────────────────────────── */

function isValidCoord(lat, lng) {
  return (
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) > 0.001 &&
    Math.abs(lng) > 0.001
  );
}

function isDifferentCoord(lat, lng) {
  if (!lastCoords) return true;
  return (
    Math.abs(lastCoords.lat - lat) > 0.0001 ||
    Math.abs(lastCoords.lng - lng) > 0.0001
  );
}

function processAndSendCoords(lat, lng, source) {
  if (!isValidCoord(lat, lng)) return;

  const isNew = isDifferentCoord(lat, lng);

  if (isNew) {
    console.log(`[CoordX Pro] ✅ NEW COORDS from ${source}:`, lat, lng);
    lastCoords = { lat, lng };
    chrome.storage.local.set({ lastCoords: { lat, lng } });

    // Notify sidepanel
    chrome.runtime.sendMessage({
      type: 'coordFound',
      lat,
      lng,
      source
    }).catch(() => {});
  }
}

/* ─── GeoGuessr API Interception via webRequest ─────────── */

// Parse response body from GeoGuessr API calls
async function parseGeoGuessrResponse(responseBody) {
  try {
    const data = JSON.parse(responseBody);
    console.log('[CoordX Pro] Parsed GeoGuessr response');

    // Check for gameSnapshot
    if (data.gameSnapshot) {
      const snapshot = data.gameSnapshot;
      const currentRound = snapshot.round || 1;
      
      // Store all rounds
      if (snapshot.rounds && Array.isArray(snapshot.rounds)) {
        allRounds = snapshot.rounds;
        console.log('[CoordX Pro] Stored', allRounds.length, 'rounds');
      }

      // Get current round coords
      if (snapshot.rounds && snapshot.rounds[currentRound - 1]) {
        const r = snapshot.rounds[currentRound - 1];
        if (isValidCoord(r.lat, r.lng)) {
          currentRoundIndex = currentRound - 1;
          processAndSendCoords(r.lat, r.lng, 'geoguessr_api_round' + currentRound);
        }
      }
    }

    // Check for rounds array directly
    if (data.rounds && Array.isArray(data.rounds)) {
      data.rounds.forEach((r, i) => {
        if (isValidCoord(r.lat, r.lng)) {
          processAndSendCoords(r.lat, r.lng, 'geoguessr_rounds_' + (i + 1));
        }
      });
    }

    // Single location
    if (isValidCoord(data.lat, data.lng)) {
      processAndSendCoords(data.lat, data.lng, 'geoguessr_single');
    }

  } catch (e) {
    console.warn('[CoordX Pro] Failed to parse response:', e.message);
  }
}

// Use declarativeNetRequest or webRequest to intercept responses
// Note: In MV3, we can't easily read response bodies with webRequest
// So we need to inject content script to do network interception

/* ─── Message Handling ────────────────────────────────── */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    case 'resetSearch':
      lastCoords = null;
      allRounds = [];
      currentRoundIndex = 0;
      chrome.storage.local.remove(['lastCoords', 'lastAddress']);
      console.log('[CoordX Pro] Search reset');
      sendResponse({ success: true });
      break;

    case 'getStatus':
      sendResponse({
        searching: true,
        trackingEnabled,
        lastCoords,
        allRoundsCount: allRounds.length,
        currentRound: currentRoundIndex + 1
      });
      break;

    case 'toggleTracking':
      trackingEnabled = message.enabled;
      chrome.storage.local.set({ trackingEnabled });
      sendResponse({ success: true, trackingEnabled });
      break;

    case 'getLastCoords':
      chrome.storage.local.get(['lastCoords']).then(result => {
        sendResponse(result.lastCoords || null);
      });
      return true;

    case 'contentCoords':
      const { lat, lng, source } = message;

      if (!isValidCoord(lat, lng)) {
        console.warn('[CoordX Pro] Invalid coords:', lat, lng);
        sendResponse({ success: false });
        return;
      }

      // If source indicates a round number, use that
      if (source && source.includes('_r') || source.includes('round')) {
        const roundMatch = source.match(/r?(\d+)/);
        if (roundMatch) {
          const round = parseInt(roundMatch[1]);
          if (round - 1 !== currentRoundIndex) {
            currentRoundIndex = round - 1;
            lastCoords = null; // Force new coords
          }
        }
      }

      processAndSendCoords(lat, lng, source);
      sendResponse({ success: true, isNew: isDifferentCoord(lat, lng) });
      break;

    case 'geoGuessrRounds':
      // Store all rounds from content script
      if (message.rounds && Array.isArray(message.rounds)) {
        allRounds = message.rounds;
        currentRoundIndex = message.currentRound || 0;
        console.log('[CoordX Pro] Received', allRounds.length, 'rounds, current:', currentRoundIndex + 1);
        
        // Send current round coords
        if (allRounds[currentRoundIndex]) {
          const r = allRounds[currentRoundIndex];
          processAndSendCoords(r.lat, r.lng, 'geoguessr_stored_round' + (currentRoundIndex + 1));
        }
      }
      sendResponse({ success: true });
      break;

    case 'advanceRound':
      if (currentRoundIndex < allRounds.length - 1) {
        currentRoundIndex++;
        console.log('[CoordX Pro] Advanced to round', currentRoundIndex + 1);
        lastCoords = null; // Force new coords
        
        if (allRounds[currentRoundIndex]) {
          const r = allRounds[currentRoundIndex];
          processAndSendCoords(r.lat, r.lng, 'geoguessr_advanced_round' + (currentRoundIndex + 1));
        }
      }
      sendResponse({ success: true, currentRound: currentRoundIndex + 1 });
      break;

    default:
      break;
  }
});

/* ─── Debug: Log when content script connects ──────────── */

console.log('[CoordX Pro] Background v1.3.0 ready');
