/**
 * CoordX Pro — Background Service Worker (v1.5.5)
 */

/* ─── State ─────────────────────────────────────────────── */

let lastCoords = null;
let trackingEnabled = true;
let allRounds = [];
let currentRoundIndex = 0;
let lastLogTime = 0;

const SUPPORTED_SITES = [
  'geoguessr.com',
  'openguessr.com',
  'worldguessr.com',
  'crazygames.com'
];

/* ─── Logging (rate-limited) ────────────────────────────── */

const LOG_KEY = 'coordx_logs';
const MAX_LOGS = 50;

async function addLog(message, time = new Date().toISOString()) {
  try {
    const result = await chrome.storage.local.get([LOG_KEY]);
    let logs = result[LOG_KEY] || [];
    logs.push({ time, message });
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(-MAX_LOGS);
    }
    await chrome.storage.local.set({ [LOG_KEY]: logs });
  } catch (e) {}
}

function log(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  console.log('[CoordX Pro]', msg);
  
  // Rate limit
  const now = Date.now();
  if (now - lastLogTime > 500) {
    lastLogTime = now;
    addLog(msg);
  }
}

/* ─── Side Panel Management ─────────────────────────────── */

function initSidePanel() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  initSidePanel();
  chrome.storage.local.set({
    trackingEnabled: true,
    lastCoords: null
  });
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
  return !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) > 0.001 &&
    Math.abs(lng) > 0.001;
}

function processAndSendCoords(lat, lng, source) {
  if (!isValidCoord(lat, lng)) return;

  log(`✅ ${source}: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  
  lastCoords = { lat, lng };
  
  // ONLY use storage - sidepanel listens to storage changes
  chrome.storage.local.set({ lastCoords: { lat, lng } });
}

/* ─── Message Handling ────────────────────────────────── */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    case 'log':
      addLog(message.message, message.time);
      sendResponse({ success: true });
      break;

    case 'getLogs':
      chrome.storage.local.get([LOG_KEY]).then(result => {
        sendResponse({ logs: result[LOG_KEY] || [] });
      });
      return true;

    case 'clearLogs':
      chrome.storage.local.set({ [LOG_KEY]: [] }).then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'resetSearch':
      lastCoords = null;
      allRounds = [];
      currentRoundIndex = 0;
      chrome.storage.local.remove(['lastCoords']);
      sendResponse({ success: true });
      break;

    case 'toggleTracking':
      trackingEnabled = message.enabled;
      chrome.storage.local.set({ trackingEnabled });
      sendResponse({ success: true, trackingEnabled });
      break;

    case 'contentCoords':
      if (!isValidCoord(message.lat, message.lng)) {
        sendResponse({ success: false });
        return;
      }

      // Parse round number from source
      if (message.source) {
        const roundMatch = message.source.match(/r(\d+)/);
        if (roundMatch) {
          currentRoundIndex = parseInt(roundMatch[1]) - 1;
        }
      }

      processAndSendCoords(message.lat, message.lng, message.source);
      sendResponse({ success: true });
      break;

    case 'geoGuessrRounds':
      if (message.rounds && Array.isArray(message.rounds)) {
        allRounds = message.rounds;
        currentRoundIndex = message.currentRound || 0;
        
        if (currentRoundIndex >= allRounds.length) {
          currentRoundIndex = Math.max(0, allRounds.length - 1);
        }
        
        if (allRounds[currentRoundIndex]) {
          const r = allRounds[currentRoundIndex];
          processAndSendCoords(r.lat, r.lng, 'round_' + (currentRoundIndex + 1));
        }
      }
      sendResponse({ success: true });
      break;

    case 'advanceRound':
      if (currentRoundIndex < allRounds.length - 1) {
        currentRoundIndex++;
        if (allRounds[currentRoundIndex]) {
          const r = allRounds[currentRoundIndex];
          processAndSendCoords(r.lat, r.lng, 'round_' + (currentRoundIndex + 1));
        }
      }
      sendResponse({ success: true, currentRound: currentRoundIndex + 1 });
      break;

    default:
      break;
  }
});

log('Background v1.5.5 ready');
