/**
 * CoordX Pro — Background Service Worker (v1.4.0)
 * 
 * - Added in-extension logging system for debugging on mobile
 * - DUAL APPROACH:
 *   1. Content script for WorldGuessr (iframe detection)
 *   2. webRequest API for GeoGuessr (intercept API calls directly)
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

/* ─── In-Extension Logging System ───────────────────────── */

const LOG_KEY = 'coordx_logs';
const MAX_LOGS = 100;

async function addLog(message, time = new Date().toISOString()) {
  try {
    const result = await chrome.storage.local.get([LOG_KEY]);
    let logs = result[LOG_KEY] || [];
    
    // Add new log
    logs.push({ time, message });
    
    // Keep only last MAX_LOGS
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(-MAX_LOGS);
    }
    
    await chrome.storage.local.set({ [LOG_KEY]: logs });
  } catch (e) {
    console.error('[CoordX Pro] Failed to save log:', e);
  }
}

function log(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  console.log('[CoordX Pro]', msg);
  addLog(msg);
}

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
  log('Extension installed v1.4.0');
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
  if (!isValidCoord(lat, lng)) {
    log('⚠️ Invalid coords rejected:', lat, lng);
    return;
  }

  const isNew = isDifferentCoord(lat, lng);

  if (isNew) {
    log(`✅ NEW COORDS from ${source}:`, lat, lng);
    lastCoords = { lat, lng };
    chrome.storage.local.set({ lastCoords: { lat, lng } });

    // Notify sidepanel
    chrome.runtime.sendMessage({
      type: 'coordFound',
      lat,
      lng,
      source
    }).catch(() => {});
  } else {
    log(`📍 Same coords from ${source}:`, lat, lng);
  }
}

/* ─── GeoGuessr API Interception via webRequest ─────────── */

// Parse response body from GeoGuessr API calls
async function parseGeoGuessrResponse(responseBody) {
  try {
    const data = JSON.parse(responseBody);
    log('Parsed GeoGuessr response');

    // Check for gameSnapshot
    if (data.gameSnapshot) {
      const snapshot = data.gameSnapshot;
      const currentRound = snapshot.round || 0;
      
      // Store all rounds
      if (snapshot.rounds && Array.isArray(snapshot.rounds)) {
        allRounds = snapshot.rounds;
        log('Stored', allRounds.length, 'rounds, current:', currentRound);
      }

      // Get current round coords
      if (snapshot.rounds && snapshot.rounds[currentRound]) {
        const r = snapshot.rounds[currentRound];
        if (isValidCoord(r.lat, r.lng)) {
          currentRoundIndex = currentRound;
          processAndSendCoords(r.lat, r.lng, 'geoguessr_api_round' + (currentRound + 1));
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
    log('Failed to parse response:', e.message);
  }
}

/* ─── Message Handling ────────────────────────────────── */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    case 'log':
      // Log from content script
      addLog(message.message, message.time);
      sendResponse({ success: true });
      break;

    case 'getLogs':
      // Get all logs
      chrome.storage.local.get([LOG_KEY]).then(result => {
        sendResponse({ logs: result[LOG_KEY] || [] });
      });
      return true;

    case 'clearLogs':
      // Clear all logs
      chrome.storage.local.set({ [LOG_KEY]: [] }).then(() => {
        log('Logs cleared');
        sendResponse({ success: true });
      });
      return true;

    case 'resetSearch':
      lastCoords = null;
      allRounds = [];
      currentRoundIndex = 0;
      chrome.storage.local.remove(['lastCoords', 'lastAddress']);
      log('Search reset');
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
      log('Tracking toggled:', trackingEnabled);
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
        log('Invalid coords from content:', lat, lng);
        sendResponse({ success: false });
        return;
      }

      // If source indicates a round number, use that
      if (source && (source.includes('_r') || source.includes('round'))) {
        const roundMatch = source.match(/r(\d+)/);
        if (roundMatch) {
          const round = parseInt(roundMatch[1]);
          if (round - 1 !== currentRoundIndex) {
            log('Round from source:', round, '(was', currentRoundIndex + 1, ')');
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
        
        // Bounds check - ensure round index is valid
        if (currentRoundIndex >= allRounds.length) {
          currentRoundIndex = Math.max(0, allRounds.length - 1);
          log('⚠️ Round index out of bounds, adjusted to', currentRoundIndex + 1);
        }
        
        log('Received', allRounds.length, 'rounds, current:', currentRoundIndex + 1);
        
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
        log('Advanced to round', currentRoundIndex + 1);
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

log('Background v1.4.0 ready');
