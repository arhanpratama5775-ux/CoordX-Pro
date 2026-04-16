# CoordX Pro 🚀 - GeoGuessr Cheat Extension

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://github.com/arhanpratama5775-ux/CoordX-Pro)
[![Version](https://img.shields.io/badge/version-1.8.29-green)](https://github.com/arhanpratama5775-ux/CoordX-Pro/releases)
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

👉 **[Download Latest Release](https://github.com/arhanpratama5775-ux/CoordX-Pro/releases/download/v1.8.29/CoordX-Pro-v1.8.29.zip)**

Atau download langsung:
```
https://github.com/arhanpratama5775-ux/CoordX-Pro/releases/download/v1.8.29/CoordX-Pro-v1.8.29.zip
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

---

## 📚 Pembelajaran: Bagaimana Extension Ini Bekerja

> **Penting:** Bagian ini untuk tujuan edukasi. Memahami bagaimana cheat bekerja membantu developer membuat sistem yang lebih aman.

### 🏗️ Arsitektur Chrome Extension

Chrome extension memiliki beberapa komponen yang berbeda:

```
┌─────────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Manifest   │    │ Background  │    │   Side      │     │
│  │   (JSON)    │    │   Script    │    │   Panel     │     │
│  │             │    │  (Service   │    │   (HTML)    │     │
│  │ Permissions │    │   Worker)   │    │             │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                  │                   │            │
│         └──────────────────┼───────────────────┘            │
│                            │                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              CONTENT SCRIPT                          │   │
│  │         (Inject ke halaman web)                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              MAIN WORLD SCRIPT                       │   │
│  │         (Berjalan di context halaman)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 📁 Struktur File Extension

```
CoordX-Pro/
├── manifest.json       # Konfigurasi extension
├── background.js       # Service worker (background process)
├── content.js          # Script yang inject ke halaman
├── main-world.js       # Script di context halaman (intercept)
├── sidepanel.html      # UI side panel
├── sidepanel.js        # Logic side panel
├── map.html            # Peta Leaflet
├── map.js              # Logic peta
├── style.css           # Styling
└── leaflet/            # Library peta
```

### 🔧 Komponen Utama

#### 1. Manifest (manifest.json)
```json
{
  "manifest_version": 3,
  "name": "CoordX Pro",
  "permissions": ["sidePanel", "webRequest", "storage"],
  "content_scripts": [{
    "matches": ["*://*.geoguessr.com/*"],
    "js": ["content.js"]
  }]
}
```

**Penjelasan:**
- `manifest_version: 3` - Versi terbaru Chrome extension
- `permissions` - Hak akses yang dibutuhkan
- `content_scripts` - Script yang di-inject ke halaman tertentu

#### 2. Content Script vs Main World

**Content Script** berjalan di **isolated world**:
- Bisa akses DOM
- TIDAK bisa akses JavaScript variables di halaman
- TIDAK bisa intercept XHR/Fetch halaman

**Main World Script** berjalan di **context halaman**:
- Bisa akses SEMUA yang halaman bisa akses
- Bisa intercept XHR/Fetch
- Harus di-inject secara special

```javascript
// Cara inject main world script
chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['main-world.js'],
  world: 'MAIN'  // ← Ini yang bikin bisa intercept!
});
```

### 🎯 Teknik Utama: XHR/Fetch Interception

Ini adalah **core technique** yang membuat extension ini bekerja.

#### Cara Intercept XMLHttpRequest (XHR)

```javascript
// Simpan fungsi original
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

// Override .open untuk capture URL
XMLHttpRequest.prototype.open = function(method, url) {
  this._url = url;  // Simpan URL untuk nanti
  return originalOpen.apply(this, arguments);
};

// Override .send untuk intercept response
XMLHttpRequest.prototype.send = function() {
  const url = this._url || '';
  
  // Tambahkan listener untuk response
  this.addEventListener('load', function() {
    // Cek apakah ini request yang kita mau
    if (url.includes('GetMetadata') || url.includes('SingleImageSearch')) {
      // Baca response!
      const response = this.responseText;
      // Extract koordinat...
    }
  });
  
  return originalSend.apply(this, arguments);
};
```

#### Cara Intercept Fetch API

```javascript
const originalFetch = window.fetch;

window.fetch = function(input, init) {
  const url = typeof input === 'string' ? input : input.url;
  
  return originalFetch.apply(this, arguments).then(response => {
    // Cek URL yang kita mau
    if (url.includes('GetMetadata') || url.includes('SingleImageSearch')) {
      // Clone response karena bisa dibaca sekali
      response.clone().text().then(text => {
        // Extract koordinat dari text...
      });
    }
    return response;  // Return response original
  });
};
```

### 🧮 Extract Koordinat dengan Regex

Google Maps API mengirim koordinat dalam format:
```
[null,null,-6.175392,106.827153]
```

Regex untuk menangkap pattern ini:
```javascript
function searchForCoords(text, source) {
  // Pattern: [null,null,LAT,LNG]
  const match = text.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
  
  if (match) {
    const lat = parseFloat(match[1]);  // -6.175392
    const lng = parseFloat(match[2]);  // 106.827153
    
    // Validasi koordinat
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      console.log('Found:', lat, lng);
    }
  }
}
```

### 📊 Flow Data Lengkap

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GEOGUESSR PAGE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Player load Street View                                         │
│     │                                                               │
│     ▼                                                               │
│  2. GeoGuessr request ke Google Maps API                            │
│     │                                                               │
│     │  GET /pb/api/geo/photometa/v1?...                             │
│     │                                                               │
│     ▼                                                               │
│  3. ████████████████████████████████████                            │
│     █  MAIN WORLD SCRIPT INTERCEPT  █                              │
│     ████████████████████████████████████                            │
│     │                                                               │
│     │  - XHR/Fetch intercepted                                      │
│     │  - Response dibaca                                            │
│     │  - Regex extract: [null,null,LAT,LNG]                         │
│     │                                                               │
│     ▼                                                               │
│  4. window.postMessage({ type: 'COORDX_COORDS', lat, lng })         │
│     │                                                               │
│     ▼                                                               │
│  5. ████████████████████████████████████                            │
│     █      CONTENT SCRIPT           █                              │
│     ████████████████████████████████████                            │
│     │                                                               │
│     │  - Listen message dari main world                             │
│     │  - Validasi koordinat                                         │
│     │  - chrome.runtime.sendMessage()                               │
│     │                                                               │
│     ▼                                                               │
│  6. ████████████████████████████████████                            │
│     █      BACKGROUND SCRIPT        █                              │
│     ████████████████████████████████████                            │
│     │                                                               │
│     │  - chrome.storage.local.set({ lastCoords: { lat, lng } })     │
│     │                                                               │
│     ▼                                                               │
│  7. ████████████████████████████████████                            │
│     █        SIDE PANEL             █                              │
│     ████████████████████████████████████                            │
│     │                                                               │
│     │  - chrome.storage.onChanged listener                          │
│     │  - Update UI (koordinat, alamat)                              │
│     │  - Kirim ke map iframe                                        │
│     │  - Fetch reverse geocoding                                    │
│     │                                                               │
│     ▼                                                               │
│  8. ████████████████████████████████████                            │
│     █         MAP (LEAFLET)         █                              │
│     ████████████████████████████████████                            │
│     │                                                               │
│     │  - Place marker di peta                                       │
│     │  - Fly to location                                            │
│     │                                                               │
│     ▼                                                               │
│  9. Player lihat lokasi! 🎯                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 🔄 Auto Round Detection

Untuk multiplayer, extension harus detect ronde baru:

```javascript
// Listen click di halaman
document.addEventListener('click', (e) => {
  const text = e.target?.innerText?.toUpperCase();
  
  // Detect tombol NEXT atau PLAY
  if (text.includes('NEXT') || text.includes('PLAY')) {
    // Block koordinat lama
    blockedLat = lastSentLat;
    blockedLng = lastSentLng;
    
    // Reset untuk ronde baru
    lastSentLat = null;
    lastSentLng = null;
  }
}, true);
```

### 🗺️ Reverse Geocoding

Mendapatkan alamat dari koordinat:

```javascript
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?
    format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  // data.address = {
  //   city: "Jakarta",
  //   state: "DKI Jakarta",
  //   country: "Indonesia",
  //   ...
  // }
}
```

### 🛡️ Kenapa Teknik Ini Sulit Dicegah?

| Aspek | Penjelasan |
|-------|------------|
| **Data di Client** | Koordinat HARUS dikirim ke browser untuk render Street View |
| **XHR/Fetch Intercept** | Teknik standar browser, tidak bisa diblock |
| **Main World Access** | Extension bisa inject script ke context apapun |
| **Google Maps API** | Format response dikontrol Google, bukan GeoGuessr |

### 🔮 Solusi yang Mungkin (dari sisi GeoGuessr)

1. **Server-side coordinate masking**
   - Tidak kirim koordinat ke client
   - Simpan di server, kirim hanya `view_id`
   - ⚠️ Mahal, butuh infrastruktur baru

2. **Encrypted payload**
   - Koordinat dienkripsi
   - Dekripsi di WebGL/native layer
   - ⚠️ Masih bisa di-hook

3. **Behavioral anti-cheat**
   - Deteksi pattern curiga
   - Time-to-guess terlalu cepat
   - Akurasi tinggi tanpa eksplorasi
   - ⚠️ Tidak mencegah, hanya mendeteksi

4. **Delayed coordinate reveal**
   - Koordinat dikirim setelah guess dikunci
   - ⚠️ Merusak UX (no preview)

### 📖 Referensi untuk Belajar Lebih Lanjut

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [ XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [Leaflet Maps](https://leafletjs.com/)
- [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/)

---

## 📝 Changelog

### v1.8.29
- ⚡ Remove debug logs for better performance
- 🍩 Donut style marker on map

### v1.8.28
- 🍩 Donut style marker on map

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
