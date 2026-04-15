/**
 * CoordX Pro — Background Service Worker (v1.6.0)
 */

let lastCoords = null;
let lastLogTime = 0;
const LOG_KEY = 'coordx_logs';
const MAX_LOGS = 50;

async function addLog(message, time = new Date().toISOString()) {
  try {
    const result = await chrome.storage.local.get([LOG_KEY]);
    let logs = result[LOG_KEY] || [];
    logs.push({ time, message });
    if (logs.length > MAX_LOGS) logs = logs.slice(-MAX_LOGS);
    await chrome.storage.local.set({ [LOG_KEY]: logs });
  } catch (e) {}
}

function log(msg) {
  console.log('[CoordX Pro]', msg);
  const now = Date.now();
  if (now - lastLogTime > 300) {
    lastLogTime = now;
    addLog(msg);
  }
}

/* ─── Init ───────────────────────────────────────────── */

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.storage.local.set({ trackingEnabled: true });
  log('Extension installed v1.6.0');
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

/* ─── Coords Handler ─────────────────────────────────── */

function isValidCoord(lat, lng) {
  return !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) > 0.001 &&
    Math.abs(lng) > 0.001;
}

function processCoords(lat, lng, source) {
  if (!isValidCoord(lat, lng)) {
    log('Invalid: ' + lat + ', ' + lng);
    return;
  }

  // Check if different from last
  const isDiff = !lastCoords || 
    Math.abs(lastCoords.lat - lat) > 0.0001 ||
    Math.abs(lastCoords.lng - lng) > 0.0001;

  if (!isDiff) {
    log('Same coords, skip');
    return;
  }

  log('✅ ' + source + ': ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
  
  lastCoords = { lat, lng };
  
  // Save to storage - sidepanel will detect change
  chrome.storage.local.set({ lastCoords: { lat, lng } });
}

/* ─── Message Handler ────────────────────────────────── */

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
      chrome.storage.local.remove(['lastCoords']);
      sendResponse({ success: true });
      break;

    case 'contentCoords':
      processCoords(message.lat, message.lng, message.source);
      sendResponse({ success: true });
      break;

    case 'toggleTracking':
      chrome.storage.local.set({ trackingEnabled: message.enabled });
      sendResponse({ success: true });
      break;
  }
});

log('Background v1.6.0 ready');
