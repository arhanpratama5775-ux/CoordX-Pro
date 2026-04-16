# CoordX Pro 🚀 - GeoGuessr & WorldGuessr Cheat Extension

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://github.com/arhanpratama5775-ux/CoordX-Pro)
[![Version](https://img.shields.io/badge/version-1.8.21-green)](https://github.com/arhanpratama5775-ux/CoordX-Pro)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> **Auto-detect Street View coordinates untuk GeoGuessr dan WorldGuessr** — Dapatkan koordinat lokasi lengkap dengan alamat, negara, dan peta interaktif.

---

## 🔍 Apa itu CoordX Pro?

**CoordX Pro** adalah Chrome extension untuk game geography seperti **GeoGuessr** dan **WorldGuessr**. Extension ini otomatis mendeteksi koordinat Street View dan menampilkan:
- 📍 Koordinat (Latitude, Longitude)
- 🏠 Alamat lengkap (negara, kota, provinsi, dll)
- 🗺️ Peta interaktif dengan marker lokasi
- 📋 Copy coordinates dengan satu klik

---

## 🎮 Game Support

| Game | Status | Mode | Website |
|------|--------|------|---------|
| **GeoGuessr** | ✅ Working | Single & Multiplayer | [geoguessr.com](https://www.geoguessr.com) |
| **WorldGuessr** | ✅ Working | Single & Multiplayer | [worldguessr.com](https://www.worldguessr.com) |
| OpenGuessr | 🚧 Coming Soon | - | - |

---

## ⚙️ Cara Kerja Extension

CoordX Pro menggunakan teknik **XHR/Fetch Interception** untuk menangkap data koordinat langsung dari API Google Maps.

### Teknologi Utama

#### 1. XHR Interception (Main World Injection)

Extension menginjeksi script ke `MAIN` world untuk mengintercept XMLHttpRequest:

```javascript
// Intercept Google Maps API calls
XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
        if (this._url.includes('GetMetadata') || 
            this._url.includes('SingleImageSearch')) {
            // Extract coordinates: [null,null,LAT,LNG]
            const match = this.responseText.match(
                /\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/
            );
        }
    });
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
   Content Script → Background → Storage
        ↓
   Sidepanel UI (Coordinates, Address, Map)
```

#### 3. Auto Round Detection

- Detect ketika pemain klik **NEXT** di GeoGuessr
- Block koordinat lama secara permanent
- Tunggu XHR intercept baru untuk koordinat ronde baru
- Works di **multiplayer** mode!

---

## 🔧 Architecture

```
CoordX-Pro/
├── manifest.json        # Chrome MV3 config
├── background.js        # Service worker
├── content.js           # Content script
├── main-world.js        # XHR intercept (MAIN world)
├── sidepanel.html/js    # Side panel UI
├── popup.html/js        # Extension popup (PC/Laptop)
├── map.html/js          # Leaflet map iframe
└── style.css            # Dark space theme
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎯 **Auto-detect** | Koordinat otomatis terdeteksi saat Street View load |
| 🔄 **Auto Round Detection** | Detect ronde baru di multiplayer |
| 🗺️ **Interactive Map** | Dark theme map dengan Leaflet |
| 📍 **Reverse Geocoding** | Alamat lengkap via OpenStreetMap |
| 📋 **Copy Coords** | One-click copy coordinates |
| 🌙 **Dark Space Theme** | UI hitam dengan animated stars |
| 🖥️ **Popup Support** | Popup untuk PC/Laptop |
| 🐛 **Debug Logs** | In-extension logging |

---

## 📥 Download & Install

### Download
```
https://github.com/arhanpratama5775-ux/CoordX-Pro/archive/refs/heads/main.zip
```

### Installation Steps

1. Download ZIP dari link di atas
2. Extract ZIP file
3. Buka Chrome → `chrome://extensions/`
4. Enable **Developer mode** (toggle kanan atas)
5. Klik **Load unpacked**
6. Pilih folder yang sudah di-extract
7. Selesai! 🎉

---

## 🚀 Cara Pakai

1. Buka **GeoGuessr** atau **WorldGuessr**
2. Mulai game
3. Klik icon extension CoordX Pro
4. **PC/Laptop:** Popup muncul → klik "Open Panel"
5. Koordinat akan auto-detect saat Street View load
6. Ronden berganti? Auto-detect lokasi baru!

---

## 📝 Changelog

### v1.8.21
- 🖥️ Enable popup for PC/Laptop
- 🎨 Dark space theme with animated stars

### v1.8.20
- 🎨 Dark space theme
- ❌ Removed "New Round" button (auto-detect works automatically)

### v1.8.18
- ✅ GeoGuessr round detection FIXED
- 🔧 XHR intercept approach from PlonkIT

### v1.8.0
- ✅ GeoGuessr support added

### v1.0.0
- 🎉 Initial release for WorldGuessr

---

## 🏷️ Keywords

`geoguessr cheat` `geoguessr hack` `geoguessr extension` `geoguessr coordinates` `worldguessr cheat` `worldguessr hack` `worldguessr extension` `street view coordinates` `geography game cheat` `chrome extension geoguessr` `auto location geoguessr` `geoguessr location finder` `geoguessr coordinates hack` `worldguessr location`

---

## 👨‍💻 Creator

| Role | Name |
|------|------|
| **AI Agent Developer** | Super Z (GLM Model by Z.ai) |
| **Human Collaborator** | arhanpratama5775-ux |

Built through human-AI collaboration. The AI agent handled:
- Architecture design
- XHR interception implementation
- Round detection logic
- UI/UX design
- Debugging and testing
- Documentation

---

## 📄 License

**MIT License** — Use freely at your own risk.

---

## ⚠️ Disclaimer

This extension is for **educational purposes** only. Using cheats in online games may violate their terms of service. The developers are not responsible for any consequences of using this extension.

---

## 🔗 Links

- **Repository:** [github.com/arhanpratama5775-ux/CoordX-Pro](https://github.com/arhanpratama5775-ux/CoordX-Pro)
- **Download:** [Latest Release](https://github.com/arhanpratama5775-ux/CoordX-Pro/archive/refs/heads/main.zip)
- **Report Issues:** [GitHub Issues](https://github.com/arhanpratama5775-ux/CoordX-Pro/issues)
