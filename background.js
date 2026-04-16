/**
 * CoordX Pro — Background Service Worker (v1.8.39)
 */

const LOG_KEY = 'coordx_logs';
const MAX_LOGS = 50;
const DEBUG_KEY = 'coordx_debug';
const MAX_DEBUG = 20;

async function addLog(message) {
  try {
    const result = await chrome.storage.local.get([LOG_KEY]);
    let logs = result[LOG_KEY] || [];
    logs.push({ time: new Date().toISOString(), message });
    if (logs.length > MAX_LOGS) logs = logs.slice(-MAX_LOGS);
    await chrome.storage.local.set({ [LOG_KEY]: logs });
  } catch (e) {}
}

async function addDebugLog(message) {
  try {
    const result = await chrome.storage.local.get([DEBUG_KEY]);
    let logs = result[DEBUG_KEY] || [];
    logs.push({ time: new Date().toISOString(), message });
    if (logs.length > MAX_DEBUG) logs = logs.slice(-MAX_DEBUG);
    await chrome.storage.local.set({ [DEBUG_KEY]: logs });
  } catch (e) {}
}

/* ─── Init ───────────────────────────────────────────── */

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ trackingEnabled: true });
});

/* ─── Auto Open Side Panel ───────────────────────────── */

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (err) {}
});

/* ─── Message Handler ────────────────────────────────── */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'log':
      addLog(message.message);
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
      chrome.storage.local.remove(['lastCoords']);
      sendResponse({ success: true });
      break;

    case 'toggleTracking':
      chrome.storage.local.set({ trackingEnabled: message.enabled });
      sendResponse({ success: true });
      break;

    case 'contentCoords':
      const { lat, lng, source } = message;

      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        sendResponse({ success: false });
        break;
      }

      addLog('✅ ' + source + ': ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
      chrome.storage.local.set({ lastCoords: { lat, lng } });
      sendResponse({ success: true });
      break;

    case 'forceUpdate':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'forceCheck' });
        }
      });
      sendResponse({ success: true });
      break;

    case 'injectMainWorld':
      if (sender.tab?.id) {
        chrome.scripting.executeScript({
          target: { tabId: sender.tab.id },
          files: ['main-world.js'],
          world: 'MAIN'
        }).catch(() => {});
      }
      sendResponse({ success: true });
      break;

    case 'placeGuess':
      // Forward place guess request to content script
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]) {
          try {
            const response = await chrome.tabs.sendMessage(tabs[0].id, {
              type: 'placeGuess',
              lat: message.lat,
              lng: message.lng,
              accuracy: message.accuracy,
              mapCenter: message.mapCenter,
              mapZoom: message.mapZoom
            });
            sendResponse(response);
          } catch (err) {
            sendResponse({ success: false, error: 'Could not communicate with page. Make sure you are on a GeoGuessr game.' });
          }
        } else {
          sendResponse({ success: false, error: 'No active tab found.' });
        }
      });
      return true;

    case 'debugLog':
      // Store debug message
      addDebugLog(message.message);
      sendResponse({ success: true });
      break;

    case 'getDebugLogs':
      chrome.storage.local.get([DEBUG_KEY]).then(result => {
        sendResponse({ logs: result[DEBUG_KEY] || [] });
      });
      return true;

    case 'clearDebugLogs':
      chrome.storage.local.set({ [DEBUG_KEY]: [] }).then(() => {
        sendResponse({ success: true });
      });
      return true;
  }
});
