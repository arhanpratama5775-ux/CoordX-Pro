/**
 * CoordX Pro — Background Service Worker (v1.1.0)
 * 
 * Intercepts GeoPhotoService network requests, extracts GPS coordinates,
 * manages side panel lifecycle, and coordinates messaging between components.
 * 
 * v1.1.0: Auto-detect new rounds in multiplayer
 */

/* ─── State ─────────────────────────────────────────────── */

let searching = true;
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
    searching = trackingEnabled;
  }
}).catch(err => console.warn('[CoordX Pro] Failed to restore state:', err));

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isSupported = SUPPORTED_SITES.some(site => tab.url.includes(site));
    if (isSupported) {
      chrome.sidePanel.setOptions({
        tabId,
        path: 'sidepanel.html',
        enabled: true
      }).catch(err => console.warn('[CoordX Pro] setOptions failed:', err));
    }
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId).then(tab => {
    if (tab.url) {
      const isSupported = SUPPORTED_SITES.some(site => tab.url.includes(site));
      if (isSupported) {
        chrome.sidePanel.setOptions({
          tabId: activeInfo.tabId,
          path: 'sidepanel.html',
          enabled: true
        }).catch(err => console.warn('[CoordX Pro] setOptions on activate failed:', err));
      }
    }
  }).catch(() => {});
});

/* ─── Web Request Interception ──────────────────────────── */

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!trackingEnabled) return;

    const url = details.url;
    if (!url.includes('GeoPhotoService')) return;

    console.log('[CoordX Pro] GeoPhotoService request intercepted:', url.substring(0, 100));
    extractCoordinates(url);
  },
  {
    urls: [
      '*://geo0.ggpht.com/*',
      '*://geo1.ggpht.com/*',
      '*://geo2.ggpht.com/*',
      '*://geo3.ggpht.com/*',
      '*://cbk0.google.com/*',
      '*://cbk1.google.com/*',
      '*://cbk2.google.com/*',
      '*://cbk3.google.com/*',
      '*://streetviewpixels-pa.googleapis.com/*'
    ]
  }
);

async function extractCoordinates(url, retryCount = 0) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const coords = parseCoordinates(text);

    if (coords) {
      console.log('[CoordX Pro] Coordinates found:', coords);
      
      // Check if this is a new round (coords significantly different)
      const isNewRound = lastCoords && (
        Math.abs(lastCoords.lat - coords.lat) > 0.001 ||
        Math.abs(lastCoords.lng - coords.lng) > 0.001
      );
      
      if (isNewRound) {
        console.log('[CoordX Pro] 🔄 New round detected! Auto-resetting...');
      }
      
      lastCoords = coords;
      searching = false;

      chrome.storage.local.set({ lastCoords: coords });

      chrome.runtime.sendMessage({
        type: 'coordFound',
        lat: coords.lat,
        lng: coords.lng
      }).catch(() => {});
    } else if (retryCount < 2) {
      setTimeout(() => extractCoordinates(url, retryCount + 1), 500);
    }
  } catch (err) {
    console.error('[CoordX Pro] extractCoordinates error:', err.message);
    if (retryCount < 2) {
      setTimeout(() => extractCoordinates(url, retryCount + 1), 1000);
    }
  }
}

function parseCoordinates(text) {
  try {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        data = JSON.parse(arrayMatch[0]);
      } else {
        return null;
      }
    }

    if (!Array.isArray(data)) return null;

    if (data.length >= 4) {
      const lat = parseFloat(data[2]);
      const lng = parseFloat(data[3]);
      if (isValidCoord(lat, lng)) {
        return { lat, lng };
      }
    }

    for (const item of data) {
      if (Array.isArray(item) && item.length >= 4) {
        const lat = parseFloat(item[2]);
        const lng = parseFloat(item[3]);
        if (isValidCoord(lat, lng)) {
          return { lat, lng };
        }
      }
    }

    return findCoordsRecursive(data);
  } catch (err) {
    console.error('[CoordX Pro] parseCoordinates error:', err.message);
    return null;
  }
}

function findCoordsRecursive(arr, depth = 0) {
  if (depth > 5 || !Array.isArray(arr)) return null;

  for (let i = 0; i < arr.length - 1; i++) {
    if (Array.isArray(arr[i])) {
      const result = findCoordsRecursive(arr[i], depth + 1);
      if (result) return result;
    }

    const lat = parseFloat(arr[i]);
    const lng = parseFloat(arr[i + 1]);
    if (isValidCoord(lat, lng)) {
      return { lat, lng };
    }
  }
  return null;
}

function isValidCoord(lat, lng) {
  return (
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/* ─── Message Handling ────────────────────────────────── */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'resetSearch':
      searching = true;
      lastCoords = null;
      chrome.storage.local.remove(['lastCoords', 'lastAddress']);
      console.log('[CoordX Pro] Search reset');
      sendResponse({ success: true });
      break;

    case 'stopSearch':
      searching = false;
      sendResponse({ success: true });
      break;

    case 'getStatus':
      sendResponse({
        searching,
        trackingEnabled,
        lastCoords
      });
      break;

    case 'toggleTracking':
      trackingEnabled = message.enabled;
      chrome.storage.local.set({ trackingEnabled });
      if (!trackingEnabled) {
        searching = false;
      } else {
        searching = true;
      }
      sendResponse({ success: true, trackingEnabled });
      break;

    case 'getLastCoords':
      chrome.storage.local.get(['lastCoords']).then(result => {
        sendResponse(result.lastCoords || null);
      });
      return true;

    case 'contentCoords':
      // Coordinates received from content script (iframe URL detection)
      const { lat, lng, source } = message;

      // Validate coordinates
      if (!isValidCoord(lat, lng)) {
        console.warn('[CoordX Pro] Invalid coords:', lat, lng);
        sendResponse({ success: false, reason: 'Invalid coords' });
        return;
      }

      // Check if this is a NEW round (coords significantly different from last)
      const isNewRound = lastCoords && (
        Math.abs(lastCoords.lat - lat) > 0.001 ||
        Math.abs(lastCoords.lng - lng) > 0.001
      );

      // Skip duplicates (same coords)
      if (lastCoords && !isNewRound) {
        console.log('[CoordX Pro] Same coords, skipping');
        sendResponse({ success: true, duplicate: true });
        return;
      }

      // Auto-accept new coordinates (new round detection)
      if (isNewRound) {
        console.log('[CoordX Pro] 🔄 NEW ROUND detected! Auto-accepting new coords...');
      }

      console.log(`[CoordX Pro] ✅ Coords from ${source}:`, lat, lng);

      lastCoords = { lat, lng };
      searching = false;

      chrome.storage.local.set({ lastCoords: { lat, lng } });

      // Notify sidepanel
      chrome.runtime.sendMessage({
        type: 'coordFound',
        lat,
        lng,
        source,
        isNewRound
      }).catch(() => {});

      sendResponse({ success: true, isNewRound });
      break;

    default:
      break;
  }
});
