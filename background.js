/**
 * CoordX Pro — Background Service Worker (v1.1.1)
 * 
 * SUPER AGGRESSIVE - Always accepts new coordinates
 * No more blocking on searching flag
 */

/* ─── State ─────────────────────────────────────────────── */

let lastCoords = null;
let trackingEnabled = true;

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
    !(lat === 0 && lng === 0)
  );
}

function isDifferentCoord(lat, lng) {
  if (!lastCoords) return true;
  return (
    Math.abs(lastCoords.lat - lat) > 0.0001 ||
    Math.abs(lastCoords.lng - lng) > 0.0001
  );
}

/* ─── Message Handling ────────────────────────────────── */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    case 'resetSearch':
      lastCoords = null;
      chrome.storage.local.remove(['lastCoords', 'lastAddress']);
      console.log('[CoordX Pro] Search reset');
      sendResponse({ success: true });
      break;

    case 'getStatus':
      sendResponse({
        searching: true, // Always searching
        trackingEnabled,
        lastCoords
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
      // ALWAYS accept coordinates from content script
      const { lat, lng, source } = message;

      if (!isValidCoord(lat, lng)) {
        console.warn('[CoordX Pro] Invalid coords:', lat, lng);
        sendResponse({ success: false });
        return;
      }

      // Check if this is a new location
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

        sendResponse({ success: true, isNew: true });
      } else {
        sendResponse({ success: true, isNew: false });
      }
      break;

    default:
      break;
  }
});
