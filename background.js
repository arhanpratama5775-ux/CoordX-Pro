/**
 * CoordX Pro — Background Service Worker (v1.7.0)
 * 
 * Uses webRequest API to intercept GeoGuessr API calls
 */

const LOG_KEY = 'coordx_logs';
const MAX_LOGS = 50;
let lastLogTime = 0;
let lastCoords = null;

async function addLog(message) {
  try {
    const result = await chrome.storage.local.get([LOG_KEY]);
    let logs = result[LOG_KEY] || [];
    logs.push({ time: new Date().toISOString(), message });
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
  log('Extension installed v1.7.0');
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

/* ─── Intercept GeoGuessr API ─────────────────────────── */

// Listen for completed requests to GeoGuessr API
chrome.webRequest.onCompleted.addListener(
  (details) => {
    // Only process API responses
    if (!details.url.includes('geoguessr.com')) return;
    if (!details.url.includes('/api/') && !details.url.includes('game')) return;
    
    log('Request: ' + details.url.substring(0, 80));
  },
  { urls: ['*://*.geoguessr.com/*'] }
);

// We need to use onBeforeRequest with requestBody, but that's limited
// Instead, let's use a content script approach

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
      lastCoords = null;
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
      
      // Check if different
      if (lastCoords && 
          Math.abs(lastCoords.lat - lat) < 0.0001 && 
          Math.abs(lastCoords.lng - lng) < 0.0001) {
        sendResponse({ success: true, skipped: true });
        break;
      }
      
      lastCoords = { lat, lng };
      log('✅ ' + source + ': ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
      
      // Save to storage - this will trigger sidepanel update
      chrome.storage.local.set({ lastCoords: { lat, lng } });
      
      sendResponse({ success: true });
      break;
      
    case 'forceUpdate':
      // Force update from content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'forceCheck' });
        }
      });
      sendResponse({ success: true });
      break;
  }
});

log('Background v1.7.0 ready');
