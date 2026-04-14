# CoordX Pro

Advanced location tracker Chrome extension for **GeoGuessr**, **OpenGuessr**, and **WorldGuessr** players.

## Features

- **Automatic Coordinate Detection** — Intercepts GeoPhotoService network requests to extract real GPS coordinates
- **Interactive Map** — Leaflet-powered dark-themed map with smooth fly-to animations
- **Detailed Address Breakdown** — Reverse geocoding via Nominatim with full address details
- **Persistent Side Panel** — State survives panel close/reopen and tab switching (the key bug fix!)
- **Quick Toggle** — Enable/disable tracking from the side panel or extension popup
- **Copy Coordinates** — One-click copy lat/lng to clipboard
- **Dark Theme** — Discord-inspired glassmorphism UI

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
- **Web Request API** — `chrome.webRequest.onCompleted` for intercepting GeoPhotoService responses
- **Leaflet + CARTO Dark Tiles** — Beautiful dark-themed map
- **Nominatim Reverse Geocoding** — Free, no API key required

## License

MIT
