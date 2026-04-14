# CoordX Pro

Advanced location tracker Chrome extension for **GeoGuessr**, **OpenGuessr**, and **WorldGuessr** players.

## Features

- **Automatic Coordinate Detection** — Intercepts network requests at page level to extract real GPS coordinates
- **Interactive Map** — Leaflet-powered dark-themed map with smooth fly-to animations
- **Detailed Address Breakdown** — Reverse geocoding via Nominatim with full address details
- **Persistent Side Panel** — State survives panel close/reopen and tab switching (the key bug fix!)
- **Quick Toggle** — Enable/disable tracking from the side panel or extension popup
- **Copy Coordinates** — One-click copy lat/lng to clipboard
- **Dark Theme** — Discord-inspired glassmorphism UI

## v1.0.2 Update - Critical Fix

This version fixes the core issue where coordinates were not being detected:

- **Content Script Injection** — Now injects a page script to intercept fetch/XHR at the page level
- **Response Body Access** — Can now read actual response bodies (service workers cannot do this directly)
- **Multiple Parse Strategies** — Improved coordinate parsing with multiple fallback strategies
- **Broader URL Detection** — Enhanced pattern matching for GeoPhotoService and related APIs

## Supported Platforms

- **GeoGuessr** — All game modes (Campaign, Classic, Duel, Battle Royale, Party, Community Maps)
- **OpenGuessr** — Standard, Capital Cities, Famous Places, Country Guessr, Competitions, Community Maps
- **WorldGuessr** — Singleplayer, Ranked Duel, Unranked Match, Party, Community Maps
- **CrazyGames** — Via embedded game players

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `CoordX-Pro` folder
5. The extension icon will appear in your toolbar

## Usage

1. Navigate to a supported game (GeoGuessr, OpenGuessr, or WorldGuessr)
2. Click the CoordX Pro icon or it will auto-open the side panel
3. Start a round — coordinates will be automatically detected
4. View the location on the map with full address details
5. Click **New Round** to reset for the next round

## Bug Fixes vs Original CoordX-Locations

| Issue | Original | CoordX Pro |
|-------|----------|------------|
| Coordinates not detected | Service worker can't read response body | Content script hooks fetch/XHR at page level |
| Side panel disappears on tab switch | No fix — panel stays closed | Auto-enables panel on supported sites + state persists in `chrome.storage` |
| Duplicate `onMessage` listeners | Two listeners in background.js | Single consolidated listener |
| Overly broad permissions | `<all_urls>` host permission | Restricted to specific game domains + Google API domains |
| No state persistence | Panel shows blank on reopen | Restores last coordinates + address from storage |
| No error recovery | Failed fetch = no coords | Retry logic (up to 2 retries) with exponential backoff |
| No popup | Must manually open side panel | Click icon to open panel + quick toggle popup |
| Broad URL filter | All URLs | Specific GeoPhotoService domains only |

## File Structure

```
CoordX-Pro/
├── manifest.json        — Extension manifest (MV3)
├── background.js        — Service worker: request interception + side panel management
├── content.js           — Content script: hooks fetch/XHR to read response bodies
├── sidepanel.html       — Side panel UI
├── sidepanel.js         — Side panel logic
├── style.css            — Dark theme styles
├── map.html             — Map iframe page
├── map.js               — Leaflet map logic
├── popup.html           — Extension popup UI
├── popup.js             — Popup logic
├── assets/
│   ├── icon16.png       — 16x16 icon
│   ├── icon48.png       — 48x48 icon
│   └── icon128.png      — 128x128 icon
└── README.md
```

## Technical Details

- **Manifest V3** — Modern Chrome extension API
- **Side Panel API** — with `setPanelBehavior({ openPanelOnActionClick: true })` for reliability
- **Storage API** — `chrome.storage.local` for state persistence across panel lifecycles
- **Content Script Injection** — Page-level fetch/XHR interception to read response bodies
- **Web Request API** — `chrome.webRequest.onCompleted` for additional request detection
- **Leaflet + CARTO Dark Tiles** — Beautiful dark-themed map
- **Nominatim Reverse Geocoding** — Free, no API key required

## How It Works

1. Content script is injected into supported game pages
2. A page script is injected to hook `window.fetch` and `XMLHttpRequest`
3. When a GeoPhotoService or Street View API request is made, the response is captured
4. Coordinates are parsed from the response using multiple strategies
5. Coordinates are sent to the background script and stored
6. Side panel displays the coordinates, reverse-geocoded address, and map location

## Download https://github.com/arhanpratama5775-ux/CoordX-Proarchive/refs/heads/main.zip
