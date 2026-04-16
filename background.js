/**
 * CoordX Pro — Background Service Worker (v1.8.29)
 */

const LOG_KEY = 'coordx_logs';
const MAX_LOGS = 50;

async function addLog(message) {
  try {
    const result = await chrome.storage.local.get([LOG_KEY]);
    let logs = result[LOG_KEY] || [];
    logs.push({ time: new Date().toISOString(), message });
    if (logs.length > MAX_LOGS) logs = logs.slice(-MAX_LOGS);
    await chrome.storage.local.set({ [LOG_KEY]: logs });
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
  }
});
