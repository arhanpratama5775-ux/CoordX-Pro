/**
 * CoordX Pro — Background Service Worker
 * 
 * Intercepts GeoPhotoService network requests, extracts GPS coordinates,
 * manages side panel lifecycle, and coordinates messaging between components.
 * 
 * Key fixes vs original:
 * - Single consolidated onMessage listener (no duplicates)
 * - Auto-opens side panel on supported sites
 * - Handles tab switching with sidePanel.setPanelBehavior
 * - Proper error handling with retry logic
 * - Restricted host permissions instead of <all_urls>
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

/**
 * Initialize side panel behavior — open on action click,
 * and stay persistent across tab switches.
 * 
 * BUG FIX: Call setPanelBehavior on BOTH onInstalled AND startup.
 * Service workers can be killed and restarted by Chrome at any time,
 * so onInstalled alone is not sufficient — we also need to set it
 * every time the service worker starts up.
 */
function initSidePanel() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(err => console.warn('[CoordX Pro] setPanelBehavior failed:', err));
}

chrome.runtime.onInstalled.addListener(() => {
  initSidePanel();
  
  // Initialize default state
  chrome.storage.local.set({
    trackingEnabled: true,
    lastCoords: null,
    lastAddress: null
  });
});

// Also set panel behavior on service worker startup
// (Chrome kills and restarts service workers, losing in-memory state)
chrome.runtime.onStartup.addListener(() => {
  initSidePanel();
});

// Immediately invoke on script load too (for soft restarts)
initSidePanel();

/**
 * BUG FIX: Restore tracking state from storage on service worker restart.
 * Service workers are ephemeral — Chrome can kill and restart them at any time,
 * which would reset `trackingEnabled` and `searching` to their defaults.
 */
chrome.storage.local.get(['trackingEnabled']).then(result => {
  if (result.trackingEnabled !== undefined) {
    trackingEnabled = result.trackingEnabled;
    searching = trackingEnabled; // If tracking was off, searching should be false too
  }
}).catch(err => console.warn('[CoordX Pro] Failed to restore state:', err));

/**
 * When user navigates to a supported site, open the side panel automatically.
 */
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

/**
 * When user switches to a tab on a supported site, make sure the panel is enabled.
 */
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

/**
 * Intercept GeoPhotoService responses to extract coordinates.
 * We use onCompleted to ensure the full response is available,
 * then re-fetch the URL to parse the protobuf/JSON data.
 */
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!trackingEnabled || !searching) return;

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

/**
 * Fetch the intercepted URL and extract lat/lng from the response.
 * Google's GeoPhotoService returns data where coordinates are typically
 * at array positions [2] (lat) and [3] (lng) in the response.
 * 
 * Uses retry logic for transient failures.
 */
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
      searching = false;
      lastCoords = coords;

      // Store in chrome.storage for persistence across panel reopenings
      await chrome.storage.local.set({ lastCoords: coords });

      // Notify all extension pages (sidepanel, popup)
      chrome.runtime.sendMessage({
        type: 'coordFound',
        lat: coords.lat,
        lng: coords.lng
      }).catch(() => {
        // Panel might not be open yet — that's OK, storage will be read on panel open
      });
    } else if (retryCount < 2) {
      // Sometimes the first interception doesn't have the right data
      console.log(`[CoordX Pro] No coords found, retry ${retryCount + 1}/2`);
      setTimeout(() => extractCoordinates(url, retryCount + 1), 500);
    }
  } catch (err) {
    console.error('[CoordX Pro] extractCoordinates error:', err.message);
    if (retryCount < 2) {
      setTimeout(() => extractCoordinates(url, retryCount + 1), 1000);
    }
  }
}

/**
 * Parse the GeoPhotoService response text to extract coordinates.
 * The response contains an array where positions [2] and [3] are lat/lng.
 * We try multiple parsing strategies to be robust.
 */
function parseCoordinates(text) {
  try {
    // Strategy 1: Parse as array directly
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Strategy 2: Find array pattern in the text
      // Google sometimes prepends )]}' or other anti-XSS prefixes
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        data = JSON.parse(arrayMatch[0]);
      } else {
        return null;
      }
    }

    if (!Array.isArray(data)) return null;

    // Strategy A: Direct positions [2] and [3]
    if (data.length >= 4) {
      const lat = parseFloat(data[2]);
      const lng = parseFloat(data[3]);
      if (isValidCoord(lat, lng)) {
        return { lat, lng };
      }
    }

    // Strategy B: Nested array — look deeper
    for (const item of data) {
      if (Array.isArray(item) && item.length >= 4) {
        const lat = parseFloat(item[2]);
        const lng = parseFloat(item[3]);
        if (isValidCoord(lat, lng)) {
          return { lat, lng };
        }
      }
    }

    // Strategy C: Search for coordinate pattern recursively
    return findCoordsRecursive(data);
  } catch (err) {
    console.error('[CoordX Pro] parseCoordinates error:', err.message);
    return null;
  }
}

/**
 * Recursively search an array structure for valid coordinate pairs.
 */
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

/**
 * Validate that coordinates are within valid ranges.
 */
function isValidCoord(lat, lng) {
  return (
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0) // Null Island check
  );
}

/* ─── Message Handling (Single Listener) ────────────────── */

/**
 * Consolidated message listener — handles all message types.
 * This fixes the duplicate listener bug from the original.
 */
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
      return true; // Async response

    case 'contentCoords':
      // Coordinates received from content script (page-level interception)
      if (!trackingEnabled || !searching) {
        sendResponse({ success: false, reason: 'Not tracking' });
        return;
      }

      const { lat, lng, source } = message;

      // Validate coordinates
      if (!isValidCoord(lat, lng)) {
        console.warn('[CoordX Pro] Invalid coords from content script:', lat, lng);
        sendResponse({ success: false, reason: 'Invalid coords' });
        return;
      }

      // Skip if same as last coords (avoid duplicates)
      if (lastCoords && lastCoords.lat === lat && lastCoords.lng === lng) {
        console.log('[CoordX Pro] Duplicate coords, skipping');
        sendResponse({ success: true, duplicate: true });
        return;
      }

      console.log(`[CoordX Pro] Coords from content script (${source}):`, lat, lng);

      searching = false;
      lastCoords = { lat, lng };

      // Store in chrome.storage for persistence
      chrome.storage.local.set({ lastCoords: { lat, lng } });

      // Notify all extension pages
      chrome.runtime.sendMessage({
        type: 'coordFound',
        lat,
        lng,
        source
      }).catch(() => {});

      sendResponse({ success: true });
      break;

    default:
      break;
  }
});
