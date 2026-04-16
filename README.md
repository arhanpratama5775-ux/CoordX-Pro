# CoordX Pro 🚀

**Chrome Extension untuk Cheat Game Geography** — Auto-detect koordinat Street View dengan detail alamat lengkap.

---

## 🎮 Game Support

| Game | Status | Mode |
|------|--------|------|
| **GeoGuessr** | ✅ Working | Single & Multiplayer |
| **WorldGuessr** | ✅ Working | Single & Multiplayer |
| OpenGuessr | 🚧 Coming Soon | - |

---

## ⚙️ Cara Kerja Extension

### Teknologi Utama

CoordX Pro menggunakan teknik **XHR/Fetch Interception** untuk menangkap data koordinat langsung dari API Google Maps.

#### 1. XHR Interception (Main World Injection)

Extension menginjeksi script ke `MAIN` world (bukan ISOLATED) untuk mengintercept XMLHttpRequest:

```javascript
// Intercept XHR calls
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
        // Check Google Maps API endpoints
        if (this._url && (this._url.includes('GetMetadata') || 
            this._url.includes('SingleImageSearch'))) {
            // Extract coordinates with regex
            const match = this.responseText.match(
                /\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/
            );
            if (match) {
                const lat = parseFloat(match[1]);
                const lng = parseFloat(match[2]);
                // Send to content script
            }
        }
    });
    return originalSend.apply(this, arguments);
};
```

#### 2. Flow Data

```
Google Maps API Response
        ↓
   XHR Intercept (Main World)
        ↓
   Regex Extract: [null,null,LAT,LNG]
        ↓
   Content Script (via window.postMessage)
        ↓
   Background Service Worker
        ↓
   Chrome Storage
        ↓
   Sidepanel UI
```

#### 3. Round Detection

Saat pemain klik **NEXT** di GeoGuessr:
1. Content script detect click pada button NEXT
2. Block koordinat lama secara permanent
3. Tunggu XHR intercept baru untuk koordinat ronde berikutnya
4. Update UI dengan koordinat baru

#### 4. Reverse Geocoding

Menggunakan **Nominatim API** (OpenStreetMap) untuk mendapatkan:
- Display Name (alamat lengkap)
- Neighborhood
- Suburb/Village
- City/Town
- District/County
- State
- Postcode
- Country

#### 5. Interactive Map

Menggunakan **Leaflet.js** dengan tile layer dari CartoDB:
- Dark theme map
- Marker dengan popup
- Auto-center ke lokasi

---

## 🔧 Architecture

```
CoordX-Pro/
├── manifest.json        # MV3 extension config
├── background.js        # Service worker (message handling, logging)
├── content.js           # Content script (coordinate forwarding)
├── main-world.js        # Main world script (XHR intercept)
├── sidepanel.html       # Side panel UI
├── sidepanel.js         # Side panel logic
├── style.css            # Dark space theme
├── popup.html/js        # Extension popup
├── map.html/js          # Leaflet map iframe
└── leaflet/             # Leaflet library
```

---

## ✨ Features

- 🎯 **Auto-detect coordinates** — Otomatis saat Street View load
- 🔄 **Auto round detection** — Detect ronde baru di multiplayer
- 🗺️ **Interactive map** — Dark theme dengan marker
- 📍 **Full address details** — Reverse geocoding lengkap
- 📋 **Copy coordinates** — One-click copy
- 🌙 **Dark Space Theme** — UI hitam luar angkasa dengan animated stars
- 🐛 **Debug Logs** — In-extension logging untuk mobile debugging

---

## 📥 Download

**GitHub Release:**
```
https://github.com/arhanpratama5775-ux/CoordX-Pro/archive/refs/heads/main.zip
```

---

## 📝 Changelog

### v1.8.20
- 🎨 Dark space theme with animated stars
- ❌ Removed "New Round" button (auto-detect now works automatically)
- 🚀 New rocket logo

### v1.8.18
- ✅ GeoGuessr round detection FIXED!
- 🔧 Implemented XHR intercept approach from PlonkIT
- 🎯 Coordinates extracted directly from Google Maps API

### v1.8.0
- ✅ GeoGuessr support added
- 🔧 Parse __NEXT_DATA__ for coordinate extraction

### v1.0.0
- 🎉 Initial release for WorldGuessr

---

## 👨‍💻 Creator

**Developed by:**
- **AI Agent:** Super Z (GLM Model by Z.ai)
- **Human Collaborator:** arhanpratama5775-ux

This extension was built through collaborative development between human and AI, with the AI agent handling:
- Architecture design
- XHR interception implementation
- Round detection logic
- UI/UX design
- Debugging and testing
- Documentation

---

## 📄 License

MIT License — Use freely at your own risk.

---

## ⚠️ Disclaimer

This extension is for educational purposes only. Using cheats in online games may violate their terms of service. The developers are not responsible for any consequences of using this extension.
