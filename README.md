# CoordX Pro 🚀 - GeoGuessr Cheat Extension

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://github.com/arhanpratama5775-ux/CoordX-Pro)
[![Version](https://img.shields.io/badge/version-1.8.30-green)](https://github.com/arhanpratama5775-ux/CoordX-Pro/releases)
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

👉 **[Download Latest Release](https://github.com/arhanpratama5775-ux/CoordX-Pro/releases/download/v1.8.30/CoordX-Pro-v1.8.30.zip)**

Atau download langsung:
```
https://github.com/arhanpratama5775-ux/CoordX-Pro/releases/download/v1.8.30/CoordX-Pro-v1.8.30.zip
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
  "version": "1.8.29",
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
  },
  "action": {
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
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

- **background.service_worker** - Service worker adalah script yang berjalan di background. Berbeda dengan background page di Manifest V2, service worker tidak persisten dan akan "tidur" saat tidak ada aktivitas untuk menghemat resource.

- **content_scripts** - Script yang secara otomatis di-inject ke halaman yang match dengan pattern `matches`. Field `run_at` menentukan kapan script dijalankan, dalam hal ini `document_start` berarti script dijalankan sebelum DOM di-parse.

---

#### 2. Content Script vs Main World - Perbedaan Kunci

Ini adalah konsep yang paling penting untuk dipahami dalam mengembangkan cheat extension. Chrome memisahkan script extension dari script halaman web menggunakan sistem isolasi yang disebut "Isolated World".

**Content Script (Isolated World)**

Content script berjalan di "isolated world" yang terpisah dari JavaScript yang berjalan di halaman web. Ini berarti:

- **BISA** mengakses dan memodifikasi DOM halaman
- **BISA** mendengarkan DOM events (click, scroll, dll)
- **TIDAK BISA** mengakses JavaScript variables/functions yang didefinisikan di halaman
- **TIDAK BISA** meng-override atau intercept XMLHttpRequest atau fetch dari halaman
- **TIDAK BISA** mengakses JavaScript objects seperti `window` properties yang dibuat oleh halaman

```javascript
// content.js - Berjalan di isolated world

// INI BISA - Akses DOM
const button = document.querySelector('#submit-button');
button.style.backgroundColor = 'red';

// INI BISA - Listen DOM events
document.addEventListener('click', (e) => {
  console.log('User clicked:', e.target);
});

// INI TIDAK BISA - Tidak bisa akses variable halaman
console.log(window.someGameVariable);  // undefined, meskipun ada di halaman

// INI TIDAK BISA - Intercept tidak bekerja
const originalFetch = window.fetch;  // Ini fetch milik isolated world, bukan halaman
window.fetch = function() { ... };   // Halaman tetap pakai fetch originalnya
```

**Main World Script (Page Context)**

Main world script berjalan di konteks yang sama dengan JavaScript halaman web. Ini berarti:

- **BISA** mengakses SEMUA yang bisa diakses oleh halaman
- **BISA** meng-override dan intercept XMLHttpRequest dan fetch
- **BISA** mengakses JavaScript variables dan functions dari halaman
- **BISA** berinteraksi dengan JavaScript frameworks (React, Vue, dll)
- **TIDAK BISA** langsung mengakses Chrome APIs (chrome.storage, dll)

```javascript
// main-world.js - Berjalan di main world (page context)

// INI BISA - Intercept fetch dari halaman
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  // Sekarang kita bisa baca response dari request halaman!
  return response;
};

// INI BISA - Akses variable global halaman
console.log(window.__INITIAL_STATE__);  // Bisa akses state React/Vue

// INI TIDAK BISA - Tidak bisa akses Chrome APIs
chrome.storage.local.get();  // Error! chrome is undefined
```

**Cara Inject Main World Script dari Content Script:**

```javascript
// content.js
function injectMainWorldScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('main-world.js');
  script.onload = function() {
    this.remove();  // Hapus script element setelah load
  };
  (document.head || document.documentElement).appendChild(script);
}

// Atau menggunakan chrome.scripting API (Manifest V3)
chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['main-world.js'],
  world: 'MAIN'  // Parameter kunci untuk inject ke main world!
});
```

---

#### 3. Background Service Worker

Background service worker adalah "otak" dari extension yang berjalan terus-menerus di background (meskipun bisa "tidur" untuk menghemat resource). Service worker bertanggung jawab untuk:

- Menangani events dari browser atau content scripts
- Menyimpan data ke chrome.storage
- Berkomunikasi antar komponen extension
- Mengelola state global extension

```javascript
// background.js - Service Worker

// Listen ketika extension icon diklik
chrome.action.onClicked.addListener(async (tab) => {
  // Buka side panel
  await chrome.sidePanel.open({ tabId: tab.id });
  
  // Inject main world script ke halaman
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['main-world.js'],
    world: 'MAIN'
  });
});

// Listen message dari content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'COORDS_FOUND') {
    const { lat, lng } = message.payload;
    
    // Simpan ke storage
    chrome.storage.local.set({
      lastCoords: { lat, lng, timestamp: Date.now() }
    });
    
    sendResponse({ success: true });
  }
  return true;  // Penting untuk async response
});

// Listen storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.lastCoords) {
    console.log('New coordinates:', changes.lastCoords.newValue);
  }
});
```

---

### 🎯 Teknik Utama: XHR/Fetch Interception

Ini adalah **core technique** yang membuat cheat extension bisa "mencuri" data dari API calls halaman web. Teknik ini disebut "Monkey Patching" atau "Function Hooking".

#### Konsep Dasar Monkey Patching

Monkey patching adalah teknik di mana kita mengganti atau memodifikasi fungsi yang sudah ada di runtime. Dalam konteks extension, kita mengganti implementasi `XMLHttpRequest` dan `fetch` dengan versi kita sendiri yang bisa "mengintip" request dan response.

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

XMLHttpRequest adalah cara lama untuk melakukan HTTP request di JavaScript. Meskipun sudah digantikan oleh fetch, banyak website masih menggunakan XHR termasuk Google Maps.

```javascript
// main-world.js

// === STEP 1: Simpan referensi ke fungsi original ===
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

// === STEP 2: Override XMLHttpRequest.prototype.open ===
// Fungsi open dipanggil pertama kali untuk setup request
XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
  // Simpan URL di instance XHR untuk digunakan nanti
  this._interceptedUrl = url;
  this._interceptedMethod = method;
  
  // Panggil fungsi original
  return originalXHROpen.apply(this, arguments);
};

// === STEP 3: Override XMLHttpRequest.prototype.send ===
// Fungsi send dipanggil untuk mengirim request
XMLHttpRequest.prototype.send = function(body) {
  const xhr = this;
  const url = xhr._interceptedUrl || '';
  
  // === STEP 4: Tambahkan event listener untuk response ===
  xhr.addEventListener('load', function() {
    // Cek apakah ini URL yang kita target
    if (url.includes('photometa') || 
        url.includes('GetMetadata') || 
        url.includes('SingleImageSearch')) {
      
      try {
        // Baca response text
        const responseText = xhr.responseText;
        
        // Extract koordinat dari response
        extractAndSendCoords(responseText, 'XHR');
      } catch (error) {
        console.error('Error intercepting XHR:', error);
      }
    }
  });
  
  // Tambahkan error handling
  xhr.addEventListener('error', function() {
    console.error('XHR error for URL:', url);
  });
  
  // Panggil fungsi original
  return originalXHRSend.apply(this, arguments);
};
```

#### Intercept Fetch API

Fetch API adalah cara modern untuk melakukan HTTP request. Response dari fetch adalah ReadableStream yang hanya bisa dibaca sekali, jadi kita perlu menggunakan `clone()` untuk membacanya tanpa mengganggu konsumsi oleh halaman.

```javascript
// main-world.js

// === STEP 1: Simpan referensi ke fungsi original ===
const originalFetch = window.fetch;

// === STEP 2: Override window.fetch ===
window.fetch = async function(input, init = {}) {
  // Parse URL dari berbagai format input
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof Request) {
    url = input.url;
  } else if (input instanceof URL) {
    url = input.href;
  }
  
  // === STEP 3: Panggil fetch original ===
  const response = await originalFetch.apply(this, arguments);
  
  // === STEP 4: Clone response dan baca jika URL match ===
  if (url.includes('photometa') || 
      url.includes('GetMetadata') || 
      url.includes('SingleImageSearch')) {
    
    // Clone response karena body hanya bisa dibaca sekali
    const clonedResponse = response.clone();
    
    try {
      // Baca response sebagai text
      const text = await clonedResponse.text();
      
      // Extract koordinat
      extractAndSendCoords(text, 'Fetch');
    } catch (error) {
      console.error('Error reading fetch response:', error);
    }
  }
  
  // === STEP 5: Return response original ke halaman ===
  // Halaman tidak akan tahu bahwa response sudah kita baca
  return response;
};
```

#### Mengapa Clone Response Penting?

```javascript
// TANPA clone (SALAH):
const response = await originalFetch.apply(this, arguments);
const text = await response.text();  // Body sudah dikonsumsi
return response;  // Halaman akan error saat mencoba baca body

// DENGAN clone (BENAR):
const response = await originalFetch.apply(this, arguments);
const clonedResponse = response.clone();
const text = await clonedResponse.text();  // Baca dari clone
return response;  // Response original masih utuh untuk halaman
```

---

### 🧮 Extract Koordinat dengan Regex

Google Maps API mengirim data dalam format yang kompleks, namun koordinat selalu ada dalam format yang konsisten: `[null,null,LATITUDE,LONGITUDE]`. Pattern ini bisa kita tangkap menggunakan Regular Expression (Regex).

#### Format Data dari Google Maps API

Response dari Google Maps API biasanya berupa JSON atau protobuf yang berisi banyak informasi tentang lokasi Street View. Namun di dalam response tersebut, selalu ada array dengan format:

```
[null,null,-6.175392,106.827153]
```

- Index 0: null (tidak digunakan)
- Index 1: null (tidak digunakan)
- Index 2: Latitude (-90 sampai 90)
- Index 3: Longitude (-180 sampai 180)

#### Regex Pattern Explanation

```javascript
function extractAndSendCoords(text, source) {
  // Regex pattern breakdown:
  // \[              - Literal opening bracket
  // null,null,      - Literal "null,null,"
  // (-?\d+\.\d+)    - Capture group untuk latitude:
  //                   -?    = optional minus sign
  //                   \d+   = one or more digits
  //                   \.    = literal dot
  //                   \d+   = one or more digits
  // ,               - Literal comma
  // (-?\d+\.\d+)    - Capture group untuk longitude (same pattern)
  // \]              - Literal closing bracket
  
  const pattern = /\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/g;
  
  // Gunakan matchAll untuk menemukan semua match
  const matches = text.matchAll(pattern);
  
  for (const match of matches) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    // Validasi range koordinat
    if (isValidCoordinate(lat, lng)) {
      console.log(`[${source}] Found coords:`, lat, lng);
      sendCoordsToExtension(lat, lng);
      return;  // Ambil yang pertama ditemukan
    }
  }
}

function isValidCoordinate(lat, lng) {
  // Latitude: -90 sampai 90
  // Longitude: -180 sampai 180
  const validLat = lat >= -90 && lat <= 90;
  const validLng = lng >= -180 && lng <= 180;
  
  // Cek apakah bukan (0, 0) yang biasanya null island
  const notNullIsland = !(lat === 0 && lng === 0);
  
  return validLat && validLng && notNullIsland;
}
```

#### Mengapa Regex Bukan JSON.parse?

```javascript
// Masalah: Response tidak selalu valid JSON
// Google Maps API bisa mengirim response dalam berbagai format:
// 1. Pure JSON
// 2. Protobuf binary
// 3. JSON dengan prefix )]}'
// 4. JSONP callback

// Regex lebih fleksibel karena:
// 1. Bisa cari pattern di text apapun
// 2. Tidak perlu parse seluruh response
// 3. Lebih cepat untuk pattern matching sederhana
// 4. Tidak error jika format tidak valid

// Contoh response Google Maps:
// )]}'{"location":{"lat":-6.175,"lng":106.82},"panoId":"abc123"...}
// Regex tetap bisa menemukan [null,null,-6.175,106.82] di dalamnya
```

---

### 📊 Flow Data Lengkap

Diagram berikut menunjukkan bagaimana data mengalir dari halaman GeoGuessr sampai ke side panel extension:

```
                          GEOGUESSR PAGE
    ================================================================

   1. Player load Street View
      Browser meminta data dari Google Maps API
                  v
   2. GeoGuessr request ke Google Maps API
      GET /pb/api/geo/photometa/v1?panoId=xxxxx
      Response berisi koordinat lokasi
                  v
   3. MAIN WORLD SCRIPT INTERCEPT
      * XHR/Fetch di-intercept sebelum sampai ke halaman
      * Response dibaca dan dicari pattern koordinat
      * Regex extract: [null,null,LAT,LNG]
      * Koordinat divalidasi range (-90,90) dan (-180,180)
                  v
   4. window.postMessage({ type: 'COORDX_COORDS', lat, lng })
      Kirim koordinat ke content script via window message
                  v
   5. CONTENT SCRIPT menerima message
      * Listen window message dari main world
      * Validasi koordinat tidak duplicate
      * chrome.runtime.sendMessage() ke background
                  v
   6. BACKGROUND SCRIPT memproses
      * chrome.storage.local.set({ lastCoords })
      * Storage change trigger listeners
                  v
   7. SIDE PANEL update UI
      * chrome.storage.onChanged listener fires
      * Update tampilan koordinat
      * Kirim koordinat ke map iframe via postMessage
      * Fetch reverse geocoding dari OpenStreetMap
                  v
   8. MAP (LEAFLET) render
      * Place marker di peta
      * Fly to location dengan animasi
      * Show donut marker untuk presisi
                  v
   9. Player lihat lokasi! 🎯
      Semua info lokasi tampil di side panel

```

---

### 🔄 Komunikasi Antar Komponen

Extension memiliki 4 komponen yang perlu berkomunikasi. Berikut adalah metode komunikasi yang digunakan:

#### 1. Main World ↔ Content Script: window.postMessage

```javascript
// main-world.js - Mengirim message
function sendCoordsToExtension(lat, lng) {
  window.postMessage({
    type: 'COORDX_COORDS',
    payload: { lat, lng, source: 'intercept' }
  }, '*');  // '*' untuk target origin (bisa dibatasi untuk keamanan)
}

// content.js - Menerima message
window.addEventListener('message', (event) => {
  // Security check: pastikan message dari window yang sama
  if (event.source !== window) return;
  
  if (event.data.type === 'COORDX_COORDS') {
    const { lat, lng } = event.data.payload;
    handleCoordinates(lat, lng);
  }
});
```

#### 2. Content Script ↔ Background: chrome.runtime.sendMessage

```javascript
// content.js - Mengirim message ke background
function handleCoordinates(lat, lng) {
  chrome.runtime.sendMessage({
    type: 'COORDS_FOUND',
    payload: { lat, lng, timestamp: Date.now() }
  }, (response) => {
    if (response?.success) {
      console.log('Coords saved to storage');
    }
  });
}

// background.js - Menerima dan memproses
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'COORDS_FOUND') {
    chrome.storage.local.set({
      lastCoords: message.payload
    });
    sendResponse({ success: true });
  }
  return true;  // Penting untuk async sendResponse
});
```

#### 3. Background ↔ Side Panel: chrome.storage

```javascript
// background.js - Menyimpan data
chrome.storage.local.set({
  lastCoords: { lat, lng, timestamp: Date.now() }
});

// sidepanel.js - Listen perubahan storage
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.lastCoords) {
    const coords = changes.lastCoords.newValue;
    updateUI(coords);
  }
});
```

#### 4. Side Panel ↔ Map iframe: window.postMessage

```javascript
// sidepanel.js - Mengirim ke map iframe
const mapIframe = document.querySelector('#map-iframe');
mapIframe.contentWindow.postMessage({
  type: 'UPDATE_LOCATION',
  lat: coords.lat,
  lng: coords.lng
}, '*');

// map.js - Menerima di iframe
window.addEventListener('message', (event) => {
  if (event.data.type === 'UPDATE_LOCATION') {
    const { lat, lng } = event.data;
    map.setView([lat, lng], 15);
    marker.setLatLng([lat, lng]);
  }
});
```

---

### 🔄 Auto Round Detection untuk Multiplayer

Di mode multiplayer, GeoGuessr memiliki multiple rounds dan extension harus bisa detect ronde baru untuk tidak menampilkan koordinat dari ronde sebelumnya.

```javascript
// content.js - Round detection logic

let lastKnownCoords = { lat: null, lng: null };
let blockedCoords = { lat: null, lng: null };

// Method 1: Detect URL change
// URL GeoGuessr berubah setiap ronde baru
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    onNewRound();
  }
}).observe(document, { subtree: true, childList: true });

// Method 2: Detect click pada tombol NEXT/PLAY
document.addEventListener('click', (e) => {
  const target = e.target;
  const buttonText = target?.innerText?.toUpperCase() || '';
  const parentText = target?.parentElement?.innerText?.toUpperCase() || '';
  
  // Check berbagai kemungkinan tombol
  const isNextButton = buttonText.includes('NEXT') || 
                       parentText.includes('NEXT') ||
                       buttonText.includes('CONTINUE') ||
                       parentText.includes('CONTINUE');
  
  if (isNextButton) {
    onNewRound();
  }
}, true);  // useCapture = true untuk catch sebelum handler lain

function onNewRound() {
  // Block koordinat lama agar tidak tampil di ronde baru
  if (lastKnownCoords.lat && lastKnownCoords.lng) {
    blockedCoords = { ...lastKnownCoords };
  }
  
  // Reset state
  lastKnownCoords = { lat: null, lng: null };
  
  // Notify UI
  chrome.runtime.sendMessage({ type: 'NEW_ROUND' });
}

// Modifikasi handler koordinat
function handleCoordinates(lat, lng) {
  // Jangan proses jika koordinat di-block
  if (lat === blockedCoords.lat && lng === blockedCoords.lng) {
    return;
  }
  
  // Jangan proses jika sama dengan koordinat terakhir
  if (lat === lastKnownCoords.lat && lng === lastKnownCoords.lng) {
    return;
  }
  
  // Update state dan kirim ke background
  lastKnownCoords = { lat, lng };
  chrome.runtime.sendMessage({
    type: 'COORDS_FOUND',
    payload: { lat, lng }
  });
}
```

---

### 🗺️ Reverse Geocoding

Reverse geocoding adalah proses mengubah koordinat (lat, lng) menjadi alamat yang bisa dibaca manusia (nama jalan, kota, negara).

#### Menggunakan OpenStreetMap Nominatim

Nominatim adalah API gratis dari OpenStreetMap yang menyediakan layanan geocoding. Kita menggunakan API ini karena gratis dan tidak memerlukan API key.

```javascript
// sidepanel.js

async function reverseGeocode(lat, lng) {
  // Nominatim API endpoint
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', lat.toString());
  url.searchParams.set('lon', lng.toString());
  url.searchParams.set('zoom', '18');        // Detail level (0-18)
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'en');
  
  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'CoordX-Pro Extension'  // Required by Nominatim
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return formatAddress(data);
    
  } catch (error) {
    console.error('Geocoding failed:', error);
    return { error: 'Failed to get address' };
  }
}

function formatAddress(data) {
  const address = data.address || {};
  
  // Ambil komponen alamat yang tersedia
  const parts = {
    road: address.road || address.pedestrian || '',
    suburb: address.suburb || address.neighbourhood || '',
    city: address.city || address.town || address.village || '',
    state: address.state || address.county || '',
    postcode: address.postcode || '',
    country: address.country || ''
  };
  
  // Format display name
  const displayParts = [];
  if (parts.road) displayParts.push(parts.road);
  if (parts.suburb) displayParts.push(parts.suburb);
  if (parts.city) displayParts.push(parts.city);
  if (parts.state) displayParts.push(parts.state);
  if (parts.country) displayParts.push(parts.country);
  
  return {
    full: displayParts.join(', '),
    short: `${parts.city}, ${parts.country}`,
    details: parts,
    raw: data
  };
}
```

#### Rate Limiting

Nominatim memiliki rate limit 1 request per detik. Kita perlu handle ini:

```javascript
let lastGeocodeTime = 0;
const GEOCODE_DELAY = 1100;  // 1.1 detik untuk aman

async function throttledGeocode(lat, lng) {
  const now = Date.now();
  const timeSinceLastGeocode = now - lastGeocodeTime;
  
  if (timeSinceLastGeocode < GEOCODE_DELAY) {
    // Wait sebelum request baru
    await new Promise(r => setTimeout(r, GEOCODE_DELAY - timeSinceLastGeocode));
  }
  
  lastGeocodeTime = Date.now();
  return reverseGeocode(lat, lng);
}
```

---

### 🛡️ Kenapa Teknik Ini Sulit Dicegah?

| Aspek | Penjelasan Detail |
|-------|-------------------|
| **Data Harus di Client** | Browser HARUS menerima koordinat untuk merender Street View. Tanpa koordinat, Street View tidak bisa menampilkan lokasi yang benar. Ini adalah fundamental limitation yang tidak bisa dihindari. |
| **XHR/Fetch Intercept** | Teknik ini menggunakan JavaScript prototype modification yang merupakan fitur standar browser. Tidak ada cara untuk mencegah extension meng-override XMLHttpRequest atau fetch karena extension memiliki akses penuh ke JavaScript environment. |
| **Main World Access** | Chrome sengaja menyediakan kemampuan untuk inject script ke main world karena ini diperlukan untuk berbagai use case legitimate seperti debugging tools, accessibility extensions, dan developer tools. |
| **Google Maps API** | Response format dari Google Maps API dikontrol oleh Google, bukan GeoGuessr. GeoGuessr tidak bisa mengubah format response tanpa koordinasi dengan Google, yang sangat tidak mungkin terjadi. |
| **No Server-Side Processing** | Semua processing dilakukan di client-side. Tidak ada server yang bisa di-block atau di-spoof karena extension berjalan di browser user sendiri. |

---

### 🔮 Solusi yang Mungkin (dari sisi GeoGuessr)

#### 1. Server-Side Coordinate Masking

**Konsep:** Tidak mengirim koordinat ke client. Sebagai gantinya, server menyimpan koordinat dan hanya mengirim `view_id` atau `session_token` ke client. Client menggunakan token ini untuk request panorama tanpa pernah tahu koordinat sebenarnya.

**Implementasi:**
```
Normal Flow:
Client request panorama --> Server returns panorama + coordinates
Client shows Street View with coordinates visible

Masked Flow:
Client request panorama --> Server generates view_id, stores coords server-side
Client shows Street View using view_id
Client never receives coordinates
```

**Kekurangan:**
- Membutuhkan infrastruktur server yang lebih kompleks
- Biaya hosting meningkat karena harus handle semua panorama requests
- Latency meningkat karena setiap pan/zoom butuh request ke server
- Tidak bisa offline mode

#### 2. Encrypted/Obfuscated Payload

**Konsep:** Koordinat dienkripsi sebelum dikirim ke client. Dekripsi dilakukan di WebGL atau WebAssembly layer yang lebih sulit di-hook.

**Implementasi:**
```javascript
// Server sends encrypted coords
response.coords = encrypt(lat, lng, sessionKey);

// Client decrypts in WASM
const wasmDecrypt = await WebAssembly.instantiate(wasmModule);
const coords = wasmDecrypt.decrypt(encryptedCoords);
```

**Kekurangan:**
- Tetap bisa di-hook di level WebGL atau WASM
- Complexity yang tinggi untuk implementasi
- Performance overhead
- Security through obscurity bukan solusi yang real

#### 3. Behavioral Anti-Cheat

**Konsep:** Tidak mencegah cheat, tapi mendeteksi pattern yang mencurigakan dan memberikan penalty atau ban.

**Metrics yang bisa di-monitor:**
```javascript
// Time-to-guess yang terlalu cepat
const timeToGuess = guessTime - roundStartTime;
if (timeToGuess < 5000 && distance < 100) {
  flagSuspicious(userID);
}

// Akurasi tanpa eksplorasi
const panoramaEvents = [pan, zoom, move];
if (panoramaEvents.length < 5 && distance < 50) {
  flagSuspicious(userID);
}

// Perfect score beruntun
if (consecutivePerfectScores > 5) {
  flagSuspicious(userID);
}

// Koordinat guess terlalu presisi
if (guessDistance < 1 && !hasProperExploration) {
  flagSuspicious(userID);
}
```

**Kekurangan:**
- Tidak mencegah, hanya mendeteksi
- False positive bisa merugikan player jujur yang kebetulan mahir
- Bisa di-bypass dengan menunggu beberapa detik sebelum guess
- Susah dibedakan antara cheat dan player yang benar-benar expert

#### 4. Watermarking/Fingerprinting

**Konsep:** Setiap panorama memiliki identifier unik yang bisa di-trace. Jika koordinat leak, bisa di-trace ke session mana.

**Kekurangan:**
- Tidak mencegah cheat, hanya untuk forensics
- Privacy concerns

---

### 📖 Referensi untuk Belajar Lebih Lanjut

**Chrome Extension Development:**
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [chrome.scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)

**JavaScript Concepts:**
- [XMLHttpRequest MDN](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest)
- [Fetch API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [Regular Expressions MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions)
- [Prototype Mutation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Inheritance_and_the_prototype_chain)

**Mapping & Geocoding:**
- [Leaflet Documentation](https://leafletjs.com/reference.html)
- [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/)
- [Google Maps Street View](https://developers.google.com/maps/documentation/streetview)

**Security Concepts:**
- [OWASP Browser Security](https://owasp.org/www-community/browser-security)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Same-Origin Policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)

---

## 📝 Changelog

### v1.8.30
- 🔄 **Multi-mode round detection** - Support Challenge, Multiplayer, Duels!
- 📍 URL change detection for automatic round tracking
- ⏱️ Timer-based round detection
- 🎯 Round indicator detection
- 🐛 Fixed round detection in challenge mode

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
