# CoordX Pro 🚀 - GeoGuessr Cheat Extension

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://github.com/arhanpratama5775-ux/CoordX-Pro)
[![Version](https://img.shields.io/badge/version-1.8.27-green)](https://github.com/arhanpratama5775-ux/CoordX-Pro/releases)
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
| ⚡ **Auto Open Panel** | Side panel langsung terbuka saat klik icon |
| 📱 **Mobile Friendly** | Works di HP tanpa perlu klik tombol tambahan |

---

## 📥 Download & Install

### Download dari Releases

👉 **[Download Latest Release](https://github.com/arhanpratama5775-ux/CoordX-Pro/releases/latest)**

Atau download langsung:
```
https://github.com/arhanpratama5775-ux/CoordX-Pro/releases/download/v1.8.27/CoordX-Pro-v1.8.27.zip
```

### Installation Steps

1. Download ZIP dari **Releases** (link di atas)
2. Buka Chrome → `chrome://extensions/`
3. Enable **Developer mode** (toggle kanan atas)
4. Klik **(from .zip/.crx/.user.js)**
5. Pilih file ZIP yang sudah didownload
6. Selesai! 🎉

---

## 🚀 Cara Pakai

1. Buka **GeoGuessr**
2. Mulai game (single player atau multiplayer)
3. Klik icon extension CoordX Pro
4. **Side panel otomatis terbuka!** ✅
5. Koordinat akan auto-detect saat Street View load
6. Ronde berganti? Auto-detect lokasi baru! ✅

---

## 📝 Changelog

### v1.8.27
- ⚡ **Auto open side panel** - Tidak perlu klik "Open Panel" lagi!
- 🗑️ Removed popup - Side panel langsung terbuka saat klik icon
- 📱 Better mobile experience

### v1.8.26
- Clean up code, focus on GeoGuessr only

### v1.8.18
- ✅ GeoGuessr round detection FIXED

### v1.8.0
- ✅ GeoGuessr support added

### v1.0.0
- 🎉 Initial release


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
