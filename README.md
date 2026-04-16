# CoordX Pro 🚀 - GeoGuessr Cheat Extension

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://github.com/arhanpratama5775-ux/CoordX-Pro)
[![Version](https://img.shields.io/badge/version-1.8.53-green)](https://github.com/arhanpratama5775-ux/CoordX-Pro/releases)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> **Auto-detect Street View coordinates untuk GeoGuessr** — Dapatkan koordinat lokasi lengkap dengan alamat, negara, peta interaktif, dan **AUTO PLACE GUESS!** 🎯

---

## 🔍 Apa itu CoordX Pro?

**CoordX Pro** adalah Chrome extension untuk game **GeoGuessr**. Extension ini otomatis mendeteksi koordinat Street View dan menampilkan:
- 📍 Koordinat (Latitude, Longitude)
- 🏠 Alamat lengkap (negara, kota, provinsi, dll)
- 🏳️ **Country Flag** - Emoji bendera negara di header!
- 🗺️ Peta interaktif dengan marker lokasi
- 📋 Copy coordinates dengan satu klik
- 🎯 **AUTO PLACE GUESS** - Place marker otomatis di map GeoGuessr!
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
| 🎯 **Auto Place Guess** | Place marker otomatis di map GeoGuessr dengan akurasi pilihan! |
| 🔄 **Auto Round Detection** | Detect ronde baru di multiplayer |
| 🤖 **Multiplayer Auto-Place** | Auto-place otomatis saat ronde baru di multiplayer! |
| 🗺️ **Interactive Map** | Dark theme map dengan Leaflet |
| 📍 **Reverse Geocoding** | Alamat lengkap via OpenStreetMap |
| 🏳️ **Country Flag** | Emoji bendera negara di header! |
| 📋 **Copy Coords** | One-click copy coordinates |
| 🌙 **Dark Space Theme** | UI hitam dengan animated stars |
| ⚡ **Auto Open Panel** | Side panel langsung terbuka saat klik icon |
| 📱 **Mobile Friendly** | Works di HP tanpa perlu klik tombol tambahan |

---

## 📥 Download & Install

### Download dari Releases

👉 **[Download Latest Release](https://github.com/arhanpratama5775-ux/CoordX-Pro/releases/download/v1.8.53/CoordX-Pro-v1.8.53.zip)**

Atau download langsung:
```
https://github.com/arhanpratama5775-ux/CoordX-Pro/releases/download/v1.8.53/CoordX-Pro-v1.8.53.zip
```

### Installation Steps

1. Download ZIP dari **Releases** (link di atas)
2. Buka Chrome → `chrome://extensions/`
3. Enable **Developer mode** (toggle kanan atas)
4. Klik **Load unpacked** atau drag & drop file ZIP
5. Selesai! 🎉

---

## 🚀 Cara Pakai

### Basic Usage
1. Buka **GeoGuessr**
2. Mulai game (single player atau multiplayer)
3. Klik icon extension CoordX Pro
4. **Side panel otomatis terbuka!** ✅
5. Koordinat akan auto-detect saat Street View load
6. Ronde berganti? Auto-detect lokasi baru! ✅

### 🎯 Auto Place Guess

Fitur ini **LANGSUNG BEKERJA** tanpa perlu buka peta! Cukup klik tombol dan marker akan otomatis ditempatkan.

#### Langkah-langkah:
1. Mainkan game GeoGuessr seperti biasa
2. Tunggu koordinat terdeteksi di side panel
3. Pilih accuracy yang diinginkan
4. Klik tombol **"Place Guess"** di side panel
5. Marker akan otomatis ditempatkan! 🎯

#### Accuracy Settings:
| Setting | Offset Distance | Est. Points |
|---------|-----------------|-------------|
| **Perfect** | 0m (exact location) | 5000 |
| **Near** | 400m - 800m | 4985-4995 |
| **Medium** | 1.5km - 3km | 4900-4970 |
| **Far** | 8km - 15km | 4300-4700 |
| **Very Far** | 40km - 70km | 2500-3500 |
| **Country** | 150km - 300km | Varies |
| **Random** | 0.5km - 100km | Varies |

> ⚠️ **Tips:** Gunakan "Near", "Medium", atau "Far" agar tidak terlihat mencurigakan. Perfect score setiap ronde bisa menarik perhatian!

---

## 📚 Pembelajaran: Bagaimana Extension Ini Bekerja

> **Penting:** Bagian ini untuk tujuan edukasi. Memahami bagaimana cheat bekerja membantu developer membuat sistem yang lebih aman.

---

### 🏗️ Arsitektur Chrome Extension

Chrome extension adalah aplikasi kecil yang berjalan di browser Chrome. Extension memiliki arsitektur yang unik karena harus berjalan terpisah dari halaman web biasa untuk alasan keamanan. Chrome menggunakan sistem isolasi yang disebut "sandbox" untuk memastikan extension tidak bisa sembarangan mengakses data dari halaman web tanpa izin.

Arsitektur Chrome extension terdiri dari beberapa komponen utama yang masing-masing memiliki peran dan konteks eksekusi yang berbeda:

```
                         CHROME EXTENSION
    ============================================================

      Manifest          Background          Side Panel
       (JSON)            Script               (HTML)
                         (Service
      Permissions         Worker)               UI

                         CONTENT SCRIPT
                      (Inject ke halaman web)

                       MAIN WORLD SCRIPT
                   (Berjalan di context halaman)

```

Setiap komponen ini berjalan di "world" atau konteks yang berbeda, dan mereka berkomunikasi melalui sistem messaging yang sudah disediakan oleh Chrome API. Pemahaman yang baik tentang arsitektur ini sangat penting untuk mengerti bagaimana extension bisa "mencuri" data dari halaman web.

---

### 📁 Struktur File Extension

```
CoordX-Pro/
├── manifest.json       # Konfigurasi extension (wajib)
├── background.js       # Service worker untuk background tasks
├── content.js          # Content script yang di-inject ke halaman
├── main-world.js       # Script yang berjalan di konteks halaman
├── sidepanel.html      # HTML untuk side panel UI
├── sidepanel.js        # JavaScript untuk side panel logic
├── map.html            # HTML untuk peta Leaflet
├── map.js              # JavaScript untuk peta functionality
├── style.css           # CSS untuk styling UI
└── leaflet/            # Library peta Leaflet (open source)
    ├── leaflet.css
    └── leaflet.js
```

File `manifest.json` adalah file paling penting karena mendefinisikan seluruh konfigurasi extension. Tanpa manifest yang benar, extension tidak akan bisa berfungsi. File ini mendefinisikan permission, content scripts, background service worker, dan berbagai konfigurasi lainnya.

---

### 🔧 Komponen Utama dan Cara Kerjanya

#### 1. Manifest V3 (manifest.json)

Manifest V3 adalah versi terbaru dari sistem Chrome extension yang diperkenalkan pada tahun 2021. Versi ini membawa perubahan signifikan dalam hal keamanan dan performa. Salah satu perubahan terbesar adalah penghapusan background page yang digantikan dengan service worker.

```json
{
  "manifest_version": 3,
  "name": "CoordX Pro",
  "version": "1.8.51",
  "description": "Auto-detect Street View coordinates",
  "permissions": [
    "sidePanel",
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "*://*.geoguessr.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["*://*.geoguessr.com/*"],
    "js": ["content.js"],
    "run_at": "document_start"
  }],
  "side_panel": {
    "default_path": "sidepanel.html"
  }
}
```

**Penjelasan detail setiap field:**

- **manifest_version: 3** - Menggunakan versi terbaru manifest. Google sudah tidak menerima extension dengan manifest V2 sejak 2024.

- **permissions** - Daftar permission yang dibutuhkan extension:
  - `sidePanel` - Untuk menampilkan side panel di browser
  - `storage` - Untuk menyimpan data koordinat
  - `activeTab` - Untuk akses tab yang sedang aktif
  - `scripting` - Untuk inject script ke halaman

- **host_permissions** - Mendefinisikan domain mana saja yang bisa diakses extension. Ini sangat penting untuk keamanan karena membatasi akses extension hanya ke domain yang diizinkan.

---

#### 2. Content Script vs Main World - Perbedaan Kunci

Ini adalah konsep yang paling penting untuk dipahami dalam mengembangkan cheat extension. Chrome memisahkan script extension dari script halaman web menggunakan sistem isolasi yang disebut "Isolated World".

**Content Script (Isolated World)**

Content script berjalan di "isolated world" yang terpisah dari JavaScript yang berjalan di halaman web. Ini berarti:

- **BISA** mengakses dan memodifikasi DOM halaman
- **BISA** mendengarkan DOM events (click, scroll, dll)
- **TIDAK BISA** mengakses JavaScript variables/functions yang didefinisikan di halaman
- **TIDAK BISA** meng-override atau intercept XMLHttpRequest atau fetch dari halaman

```javascript
// content.js - Berjalan di isolated world

// INI BISA - Akses DOM
const button = document.querySelector('#submit-button');

// INI TIDAK BISA - Tidak bisa akses variable halaman
console.log(window.someGameVariable);  // undefined
```

**Main World Script (Page Context)**

Main world script berjalan di konteks yang sama dengan JavaScript halaman web:

- **BISA** mengakses SEMUA yang bisa diakses oleh halaman
- **BISA** meng-override dan intercept XMLHttpRequest dan fetch
- **BISA** mengakses JavaScript variables dan functions dari halaman
- **BISA** berinteraksi dengan JavaScript frameworks (React, Vue, dll)

```javascript
// main-world.js - Berjalan di main world (page context)

// INI BISA - Intercept fetch dari halaman
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  // Baca response!
  return response;
};
```

---

### 🎯 Teknik Utama: XHR/Fetch Interception

Ini adalah **core technique** yang membuat cheat extension bisa "mencuri" data dari API calls halaman web. Teknik ini disebut "Monkey Patching" atau "Function Hooking".

```
Normal Flow:
Page --> XMLHttpRequest --> Server --> Response --> Page

With Interception:
Page --> [OUR INTERCEPTOR] --> XMLHttpRequest --> Server --> Response --> [OUR INTERCEPTOR] --> Page
                                              |
                                              v
                                        We read the response!
```

#### Intercept XMLHttpRequest (XHR)

```javascript
// main-world.js

const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url) {
  this._interceptedUrl = url;
  return originalXHROpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function(body) {
  const xhr = this;
  const url = xhr._interceptedUrl || '';
  
  xhr.addEventListener('load', function() {
    if (url.includes('GetMetadata') || url.includes('SingleImageSearch')) {
      const responseText = xhr.responseText;
      extractAndSendCoords(responseText);
    }
  });
  
  return originalXHRSend.apply(this, arguments);
};
```

---

### 🆕 Teknik Auto Place Guess: React Fiber Method

Ini adalah teknik paling canggih yang digunakan untuk **menempatkan marker secara otomatis** di map GeoGuessr. Teknik ini terinspirasi dari "Geoguessr Location Resolver" script.

#### Konsep Dasar

Alih-alih mensimulasikan klik mouse (yang tidak akurat karena perlu kalkulasi pixel), kita **langsung memanggil internal click handler** dari Google Maps yang ada di React component tree!

```
Traditional Click Simulation:
Calculate pixel position → Simulate mouse click → Hope it hits the right spot
❌ Butuh panning map
❌ Perhitungan pixel kompleks
❌ Tidak akurat

React Fiber Method:
Find map element → Traverse React fiber → Get click handler → Call with fake latLng
✅ Tidak perlu panning
✅ Langsung koordinat akurat
✅ 100% berhasil
```

#### React Fiber Tree Traversal

React menyimpan semua komponen dan props-nya dalam struktur data internal yang disebut "Fiber Tree". Setiap DOM element yang di-render oleh React memiliki referensi ke fiber node-nya melalui property `__reactFiber$...`.

```javascript
// main-world.js - React Fiber Method

function placeMarkerReact(lat, lng) {
  // Step 1: Find the guess map canvas
  const element = document.querySelector('[class^="guess-map_canvas__"]');
  
  // Step 2: Get React Fiber key
  const reactKey = Object.keys(element).find(key => key.startsWith('__reactFiber$'));
  const elementProps = element[reactKey];
  
  // Step 3: Navigate through fiber tree to find map click handler
  // Path: elementProps.return.return.memoizedProps.map.__e3_.click
  const mapProps = elementProps?.return?.return?.memoizedProps?.map;
  const clickHandlers = mapProps.__e3_?.click;
  
  // Step 4: Create fake latLng object
  // This mimics the event object that Google Maps passes to click handlers
  const latLngFns = {
    latLng: {
      lat: () => lat,  // Return target latitude
      lng: () => lng,  // Return target longitude
    }
  };
  
  // Step 5: Call the click handler with our fake latLng!
  const handlerKeys = Object.keys(clickHandlers);
  const lastKey = handlerKeys[handlerKeys.length - 1];
  const clickHandler = clickHandlers[lastKey];
  
  // Call all functions in the handler
  for (const key of Object.keys(clickHandler)) {
    if (typeof clickHandler[key] === 'function') {
      clickHandler[key](latLngFns);  // Marker placed!
    }
  }
}
```

#### Mengapa Ini Bekerja?

1. **Google Maps menyimpan click handlers** di properti `__e3_` dari map object
2. **Handler expect event object** dengan `latLng.lat()` dan `latLng.lng()` functions
3. **Kita create fake event object** yang return koordinat target kita
4. **Handler tidak bisa membedakan** antara click asli dan fake event kita!

```javascript
// Google Maps click handler (internal):
function handleClick(event) {
  const lat = event.latLng.lat();  // Calls our function!
  const lng = event.latLng.lng();  // Calls our function!
  placeMarker(lat, lng);           // Marker placed at our coordinates!
}
```

#### Fiber Tree Structure

```
DOM Element (guess-map_canvas__)
    │
    └── __reactFiber$xxxxx (Fiber Node)
            │
            └── return (Parent Fiber)
                    │
                    └── return (Grandparent Fiber)
                            │
                            └── memoizedProps
                                    │
                                    └── map (Google Maps instance)
                                            │
                                            ├── __e3_ (Event listeners)
                                            │       │
                                            │       └── click (Click handlers)
                                            │               │
                                            │               └── {key: fn, ...}
                                            │
                                            └── ... other map properties
```

#### Keuntungan Metode Ini

| Aspek | Click Simulation | React Fiber Method |
|-------|-----------------|-------------------|
| **Akurasi** | Tergantung pixel calculation | 100% akurat |
| **Panning** | Perlu pan map dulu | Tidak perlu |
| **Koordinat** | Harus kalkulasi pixel | Langsung lat/lng |
| **Reliability** | Bisa miss | Selalu hit |
| **Complexity** | Tinggi (math) | Sedang (tree traversal) |

---

### 🧮 Extract Koordinat dengan Regex

Google Maps API mengirim data dalam format yang kompleks, namun koordinat selalu ada dalam format yang konsisten: `[null,null,LATITUDE,LONGITUDE]`.

```javascript
function extractAndSendCoords(text) {
  // Pattern: [null,null,-6.175392,106.827153]
  const pattern = /\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/g;
  
  const matches = text.matchAll(pattern);
  
  for (const match of matches) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      sendCoordsToExtension(lat, lng);
      return;
    }
  }
}
```

---

### 📊 Flow Data Lengkap

```
                          GEOGUESSR PAGE
    ================================================================

   1. Player load Street View
      Browser request ke Google Maps API
                  ↓
   2. MAIN WORLD SCRIPT INTERCEPT
      XHR/Fetch di-intercept
      Regex extract koordinat
                  ↓
   3. window.postMessage() ke Content Script
                  ↓
   4. Content Script → Background → Storage
                  ↓
   5. Side Panel update UI
      - Tampilkan koordinat
      - Fetch alamat dari OpenStreetMap
      - Update map Leaflet
                  ↓
   6. Player klik "Place Guess"
                  ↓
   7. MAIN WORLD: React Fiber Traversal
      Find click handler
      Call dengan fake latLng
                  ↓
   8. Marker placed di map GeoGuessr! 🎯
```

---

### 🛡️ Kenapa Teknik Ini Sulit Dicegah?

| Aspek | Penjelasan |
|-------|------------|
| **Data Harus di Client** | Browser HARUS menerima koordinat untuk merender Street View |
| **XHR/Fetch Intercept** | Teknik ini menggunakan JavaScript prototype modification yang merupakan fitur standar browser |
| **React Fiber Access** | React menyimpan data di DOM untuk performa, ini tidak bisa dihindari |
| **Google Maps API** | Response format dikontrol oleh Google, bukan GeoGuessr |

---

### 📖 Referensi untuk Belajar Lebih Lanjut

**Chrome Extension Development:**
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)

**React Internals:**
- [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)
- [React Internal State](https://reactjs.org/docs/faq-state.html)
- [Understanding React Fiber](https://medium.com/react-in-depth/inside-fiber-in-depth-overview-of-the-new-reconciliation-algorithm-in-react-e1c04700ef6e)

**JavaScript Concepts:**
- [XMLHttpRequest MDN](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest)
- [Fetch API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [Regular Expressions MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions)

**Inspiration:**
- [Geoguessr Location Resolver](https://greasyfork.org/en/scripts/450253-geoguessr-location-resolver-works-in-all-modes) - Teknik React Fiber untuk place marker

---

## 📝 Changelog

### v1.8.53 🔧
- 🔧 **FIXED DOUBLE OFFSET BUG!** - Offset sekarang hanya dihitung sekali
- ✅ sidepanel.js sudah pakai min-max range (sama seperti main-world.js)
- 🐛 Fixed error "Cannot read properties of undefined (reading 'url')"
- 🔧 Gabungkan fetch intercept supaya tidak saling override

### v1.8.52 📊
- 📊 **FIXED ACCURACY OFFSET!** - Sekarang pakai min-max range!
  - Near: 400-800m (selalu di range ini, bukan 0-500m)
  - Medium: 1.5-3km
  - Far: 8-15km
  - Very Far: 40-70km
  - Country: 150-300km
- ✅ Offset sekarang konsisten, tidak akan dapet 310m untuk Near

### v1.8.51 🏳️
- 🏳️ **COUNTRY FLAG!** - Emoji bendera negara di header!
- 🎨 Flag emoji dari country code (ISO 3166-1 alpha-2)
- 📝 Short name untuk negara populer (USA, UK, etc.)
- ✨ UI yang clean dengan flag di sebelah toggle

### v1.8.50 📊
- 📊 **UPDATED ACCURACY SETTINGS!** - Offset lebih realistis!
  - Near: ~500m (was 100m)
  - Medium: ~2km (was 500m)
  - Far: ~10km (was 2km)
  - Very Far: ~50km (NEW!)
  - Country: ~200km (NEW!)
  - Random: 1-100km (was 0-5km)
- ✅ **Works WITHOUT opening map!** - Langsung place tanpa buka peta dulu!
- 🔧 Fixed offset calculation untuk accuracy yang lebih konsisten

### v1.8.49 🤖
- 🤖 **MULTIPLAYER AUTO-PLACE!** - Auto-detect ronde baru dan auto-place marker!
- 🔍 3 detection methods: URL change, DOM watch (guess map), API intercept
- 🎯 Auto-place pakai accuracy setting yang dipilih
- 📊 UI feedback saat auto-place triggered
- 🔄 Seamless experience untuk multiplayer games (Duels, Battle Royale, dll)

### v1.8.48 🎯
- 🎯 **AUTO PLACE GUESS!** - Place marker otomatis di map GeoGuessr!
- 🔧 Menggunakan React Fiber method (inspired by Location Resolver)
- ✨ Tidak perlu panning map - langsung place di koordinat akurat
- 📊 Multiple accuracy settings: Perfect, Near, Medium, Far, Random

### v1.8.32
- 🔄 **Round Detection v2** - 7 detection methods for all game modes!
- ⏱️ Timer countdown detection (multiplayer/duels)
- 📊 Score screen detection

### v1.8.30
- 🔄 **Multi-mode round detection** - Support Challenge, Multiplayer, Duels!

### v1.8.27
- ⚡ **Auto open side panel** - Tidak perlu klik "Open Panel" lagi!

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
