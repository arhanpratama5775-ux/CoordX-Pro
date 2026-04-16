# CoordX Pro 🚀 - GeoGuessr Cheat Extension

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://github.com/arhanpratama5775-ux/CoordX-Pro)
[![Version](https://img.shields.io/badge/version-1.8.26-green)](https://github.com/arhanpratama5775-ux/CoordX-Pro)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> **Auto-detect Street View coordinates untuk GeoGuessr** — Dapatkan koordinat lokasi lengkap dengan alamat, negara, dan peta interaktif. Works di single player dan multiplayer!

---

## 🔍 Apa itu CoordX Pro?

**CoordX Pro** adalah Chrome extension untuk game **GeoGuessr**. Extension ini otomatis mendeteksi koordinat Street View dan menampilkan:
- 📍 Koordinat (Latitude, Longitude)
- 🏠 Alamat lengkap (negara, kota, provinsi, dll)
- 🗺️ Peta interaktif dengan marker lokasi
- 📋 Copy coordinates dengan satu klik
- 🔄 Auto round detection untuk multiplayer!

---

## 🎮 Game Support

| Game | Status | Mode |
|------|--------|------|
| **GeoGuessr** | ✅ Working | Single & Multiplayer |

---

## ⚙️ Cara Kerja Extension

CoordX Pro menggunakan teknik **XHR/Fetch Interception** untuk menangkap data koordinat langsung dari Google Maps API.

### Teknologi Utama

Extension mengintercept XMLHttpRequest ke Google Maps API:

```
Google Maps API (GetMetadata / SingleImageSearch)
        ↓
   XHR/Fetch Intercept
        ↓
   Regex: [null,null,LAT,LNG]
        ↓
   Content Script → Background → Storage
        ↓
   Sidepanel UI (Coordinates + Address + Map)
```

### Auto Round Detection

- Detect ketika pemain klik **NEXT** di GeoGuessr
- Block koordinat lama secara permanent
- Tunggu intercept baru untuk koordinat ronde berikutnya
- **Works di multiplayer mode!**

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
| 🐛 **Debug Logs** | In-extension logging untuk debugging |

---

## 📥 Download & Install

### Download
```
https://github.com/arhanpratama5775-ux/CoordX-Pro/archive/refs/heads/main.zip
```

### Installation Steps

1. Download ZIP dari link di atas
2. Buka Chrome → `chrome://extensions/`
3. Enable **Developer mode** (toggle kanan atas)
4. Klik **(from .zip/.crx/.user.js)**
5. Pilih CoordX-Pro-main.zip
6. Selesai! 🎉

---

## 🚀 Cara Pakai

1. Buka **GeoGuessr**
2. Mulai game (single player atau multiplayer)
3. Klik icon extension CoordX Pro
4. **PC/Laptop:** Popup muncul → klik "Open Panel"
5. Koordinat akan auto-detect saat Street View load
6. Ronde berganti? Auto-detect lokasi baru! ✅

---

## 📝 Changelog

### v1.8.26
- Clean up code, focus on GeoGuessr only

### v1.8.18
- ✅ GeoGuessr round detection FIXED
- 🔧 XHR intercept approach from PlonkIT

### v1.8.0
- ✅ GeoGuessr support added

### v1.0.0
- 🎉 Initial release

---

## 🏷️ Keywords

`geoguessr cheat` `geoguessr hack` `geoguessr extension` `geoguessr coordinates` `street view coordinates` `geography game cheat` `chrome extension geoguessr` `auto location geoguessr` `geoguessr location finder` `geoguessr coordinates hack`

---

## 👨‍💻 Creator

| Role | Name |
|------|------|
| **AI Agent Developer** | Super Z (GLM Model by Z.ai) |
| **Human Collaborator** | arhanpratama5775-ux |

Built through human-AI collaboration.

---

## 📄 License

**MIT License** — Use freely at your own risk.

---

## ⚠️ Disclaimer

This extension is for **educational purposes** only. Using cheats in online games may violate their terms of service. The developers are not responsible for any consequences of using this extension.
