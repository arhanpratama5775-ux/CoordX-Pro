/**
 * CoordX Pro — Floating Panel (v1.9.0)
 *
 * Draggable & Resizable floating panel for GeoGuessr
 * Injected directly into the page
 */

(function () {
  'use strict';

  // Prevent duplicate injection
  if (window.__coordxFloatingPanel) return;
  window.__coordxFloatingPanel = true;

  // Panel state
  let panelState = {
    x: 20,
    y: 20,
    width: 320,
    height: 'auto',
    minimized: false,
    collapsed: false
  };

  // Current coords
  let currentLat = null;
  let currentLng = null;

  // Create floating panel
  function createFloatingPanel() {
    const panel = document.createElement('div');
    panel.id = 'coordx-floating-panel';
    panel.innerHTML = `
      <!-- Header -->
      <div id="cxp-header">
        <div id="cxp-header-left">
          <span id="cxp-logo">🏔️</span>
          <div id="cxp-title-group">
            <span id="cxp-title">CoordX Pro</span>
            <span id="cxp-status">Searching...</span>
          </div>
        </div>
        <div id="cxp-controls">
          <button id="cxp-minimize" title="Minimize">−</button>
          <button id="cxp-collapse" title="Collapse">▼</button>
          <button id="cxp-close" title="Close">×</button>
        </div>
      </div>

      <!-- Content -->
      <div id="cxp-content">
        <!-- Coordinates -->
        <div class="cxp-section" id="cxp-coords-section">
          <div class="cxp-coords-card">
            <div class="cxp-coord">
              <span class="cxp-label">LAT</span>
              <span class="cxp-value" id="cxp-lat">—</span>
            </div>
            <div class="cxp-divider"></div>
            <div class="cxp-coord">
              <span class="cxp-label">LNG</span>
              <span class="cxp-value" id="cxp-lng">—</span>
            </div>
          </div>
          <button class="cxp-btn" id="cxp-copy">📋 Copy Coords</button>
        </div>

        <!-- Country Flag -->
        <div class="cxp-section cxp-flag-section" id="cxp-flag-section">
          <div class="cxp-flag">
            <span id="cxp-flag-emoji">🌍</span>
            <span id="cxp-flag-name">—</span>
          </div>
        </div>

        <!-- Address -->
        <div class="cxp-section" id="cxp-address-section">
          <div class="cxp-section-header">
            <span>📍</span> Address
          </div>
          <div class="cxp-address-grid" id="cxp-address-grid">
            <div class="cxp-addr-row">
              <span class="cxp-addr-label">City</span>
              <span class="cxp-addr-value" id="cxp-city">—</span>
            </div>
            <div class="cxp-addr-row">
              <span class="cxp-addr-label">State</span>
              <span class="cxp-addr-value" id="cxp-state">—</span>
            </div>
            <div class="cxp-addr-row">
              <span class="cxp-addr-label">Country</span>
              <span class="cxp-addr-value" id="cxp-country">—</span>
            </div>
          </div>
        </div>

        <!-- Auto Place -->
        <div class="cxp-section" id="cxp-autoplace-section">
          <div class="cxp-section-header">
            <span>🎯</span> Auto Place
          </div>
          <div class="cxp-autoplace-controls">
            <div class="cxp-row">
              <label>Accuracy:</label>
              <select id="cxp-accuracy">
                <option value="perfect">Perfect (0m)</option>
                <option value="near">Near (400-800m)</option>
                <option value="medium" selected>Medium (1.5-3km)</option>
                <option value="far">Far (8-15km)</option>
                <option value="veryfar">Very Far (40-70km)</option>
                <option value="country">Country (150-300km)</option>
                <option value="random">Random</option>
              </select>
            </div>
            <button class="cxp-btn cxp-btn-primary" id="cxp-place" disabled>
              📍 Place Guess
            </button>
            <div class="cxp-status-msg" id="cxp-place-status">Waiting for coords...</div>
          </div>
        </div>
      </div>

      <!-- Resize Handle -->
      <div id="cxp-resize-handle"></div>
    `;

    // Add styles
    const styles = document.createElement('style');
    styles.textContent = `
      /* Panel Base */
      #coordx-floating-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 320px;
        background: rgba(5, 6, 8, 0.95);
        border: 1px solid rgba(74, 158, 255, 0.3);
        border-radius: 12px;
        color: #e8f0f8;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        z-index: 2147483647;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(74, 158, 255, 0.15);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        user-select: none;
        transition: height 0.2s ease;
      }

      #coordx-floating-panel.minimized #cxp-content,
      #coordx-floating-panel.minimized #cxp-resize-handle {
        display: none;
      }

      #coordx-floating-panel.collapsed #cxp-content {
        display: none;
      }

      /* Header */
      #cxp-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        background: linear-gradient(135deg, rgba(74, 158, 255, 0.15), rgba(42, 196, 255, 0.1));
        border-radius: 12px 12px 0 0;
        cursor: move;
        border-bottom: 1px solid rgba(74, 158, 255, 0.2);
      }

      #cxp-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      #cxp-logo {
        font-size: 18px;
        filter: drop-shadow(0 0 6px rgba(74, 158, 255, 0.5));
      }

      #cxp-title-group {
        display: flex;
        flex-direction: column;
      }

      #cxp-title {
        font-size: 13px;
        font-weight: 700;
        background: linear-gradient(135deg, #4a9eff, #2ac4ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      #cxp-status {
        font-size: 10px;
        color: #8a9aaa;
        transition: color 0.3s;
      }

      #cxp-status.found {
        color: #4ad4ff;
        text-shadow: 0 0 8px rgba(74, 212, 255, 0.4);
      }

      #cxp-controls {
        display: flex;
        gap: 4px;
      }

      #cxp-controls button {
        width: 22px;
        height: 22px;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 4px;
        color: #8a9aaa;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      #cxp-controls button:hover {
        background: rgba(74, 158, 255, 0.3);
        color: #fff;
      }

      /* Content */
      #cxp-content {
        padding: 10px;
        max-height: 400px;
        overflow-y: auto;
      }

      #cxp-content::-webkit-scrollbar {
        width: 4px;
      }

      #cxp-content::-webkit-scrollbar-thumb {
        background: rgba(74, 158, 255, 0.3);
        border-radius: 4px;
      }

      /* Sections */
      .cxp-section {
        margin-bottom: 10px;
      }

      .cxp-section:last-child {
        margin-bottom: 0;
      }

      .cxp-section-header {
        font-size: 11px;
        font-weight: 600;
        color: #4ad4ff;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* Coords Card */
      .cxp-coords-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(10, 15, 25, 0.6);
        border: 1px solid rgba(74, 158, 255, 0.2);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 8px;
      }

      .cxp-coord {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        flex: 1;
      }

      .cxp-label {
        font-size: 9px;
        font-weight: 600;
        color: #4ad4ff;
        letter-spacing: 1px;
      }

      .cxp-value {
        font-size: 14px;
        font-weight: 600;
        font-family: 'JetBrains Mono', 'SF Mono', monospace;
        color: #fff;
        text-shadow: 0 0 10px rgba(74, 158, 255, 0.3);
      }

      .cxp-divider {
        width: 1px;
        height: 30px;
        background: linear-gradient(180deg, transparent, rgba(74, 158, 255, 0.3), transparent);
      }

      /* Flag */
      .cxp-flag-section {
        display: none;
      }

      .cxp-flag-section.active {
        display: block;
      }

      .cxp-flag {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(10, 15, 25, 0.6);
        border: 1px solid rgba(74, 158, 255, 0.2);
        border-radius: 8px;
        padding: 8px 12px;
      }

      #cxp-flag-emoji {
        font-size: 24px;
      }

      #cxp-flag-name {
        font-size: 11px;
        font-weight: 600;
        color: #4ad4ff;
        text-transform: uppercase;
      }

      /* Address */
      .cxp-address-grid {
        background: rgba(10, 15, 25, 0.6);
        border: 1px solid rgba(74, 158, 255, 0.2);
        border-radius: 8px;
        overflow: hidden;
      }

      .cxp-addr-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 10px;
        border-bottom: 1px solid rgba(74, 158, 255, 0.1);
      }

      .cxp-addr-row:last-child {
        border-bottom: none;
      }

      .cxp-addr-label {
        color: #6a7a8a;
        font-size: 10px;
      }

      .cxp-addr-value {
        color: #e8f0f8;
        font-size: 10px;
        max-width: 150px;
        text-align: right;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Auto Place */
      .cxp-autoplace-controls {
        background: rgba(10, 15, 25, 0.6);
        border: 1px solid rgba(74, 158, 255, 0.2);
        border-radius: 8px;
        padding: 10px;
      }

      .cxp-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .cxp-row label {
        color: #8a9aaa;
        font-size: 10px;
      }

      .cxp-row select {
        background: rgba(20, 25, 35, 0.8);
        border: 1px solid rgba(74, 158, 255, 0.3);
        border-radius: 4px;
        color: #e8f0f8;
        padding: 5px 8px;
        font-size: 10px;
        cursor: pointer;
      }

      .cxp-row select:focus {
        outline: none;
        border-color: #4a9eff;
      }

      /* Buttons */
      .cxp-btn {
        width: 100%;
        padding: 8px 12px;
        background: rgba(20, 25, 35, 0.8);
        border: 1px solid rgba(74, 158, 255, 0.3);
        border-radius: 6px;
        color: #e8f0f8;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .cxp-btn:hover {
        background: rgba(30, 35, 50, 0.9);
        border-color: #4a9eff;
      }

      .cxp-btn-primary {
        background: linear-gradient(135deg, #4a9eff, #2ac4ff);
        border: none;
        color: white;
        font-weight: 600;
      }

      .cxp-btn-primary:hover:not(:disabled) {
        box-shadow: 0 4px 15px rgba(74, 158, 255, 0.4);
        transform: translateY(-1px);
      }

      .cxp-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .cxp-btn-primary.placed {
        background: linear-gradient(135deg, #3fb950, #22c55e);
      }

      .cxp-status-msg {
        font-size: 9px;
        color: #6a7a8a;
        text-align: center;
        margin-top: 6px;
      }

      .cxp-status-msg.ready {
        color: #4ad4ff;
      }

      .cxp-status-msg.error {
        color: #ff5a5a;
      }

      /* Resize Handle */
      #cxp-resize-handle {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 20px;
        height: 20px;
        cursor: nwse-resize;
        opacity: 0.5;
      }

      #cxp-resize-handle::after {
        content: '';
        position: absolute;
        bottom: 4px;
        right: 4px;
        width: 10px;
        height: 10px;
        border-right: 2px solid rgba(74, 158, 255, 0.5);
        border-bottom: 2px solid rgba(74, 158, 255, 0.5);
        border-radius: 0 0 4px 0;
      }

      #cxp-resize-handle:hover {
        opacity: 1;
      }

      /* Minimized state */
      #coordx-floating-panel.minimized {
        height: auto !important;
      }
    `;

    document.head.appendChild(styles);
    document.body.appendChild(panel);

    // Make draggable
    makeDraggable(panel);

    // Make resizable
    makeResizable(panel);

    // Setup controls
    setupControls(panel);

    // Load saved state
    loadState();
  }

  // Draggable functionality
  function makeDraggable(panel) {
    const header = panel.querySelector('#cxp-header');
    let isDragging = false;
    let startX, startY, initialX, initialY;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialX = panel.offsetLeft;
      initialY = panel.offsetTop;
      panel.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = (initialX + dx) + 'px';
      panel.style.top = (initialY + dy) + 'px';
      panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        panel.style.transition = '';
        saveState();
      }
    });

    // Touch support
    header.addEventListener('touchstart', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      initialX = panel.offsetLeft;
      initialY = panel.offsetTop;
      panel.style.transition = 'none';
    });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      panel.style.left = (initialX + dx) + 'px';
      panel.style.top = (initialY + dy) + 'px';
      panel.style.right = 'auto';
    });

    document.addEventListener('touchend', () => {
      if (isDragging) {
        isDragging = false;
        panel.style.transition = '';
        saveState();
      }
    });
  }

  // Resizable functionality
  function makeResizable(panel) {
    const handle = panel.querySelector('#cxp-resize-handle');
    let isResizing = false;
    let startX, startY, startWidth;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = panel.offsetWidth;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const width = startWidth - (e.clientX - startX);
      if (width >= 280 && width <= 500) {
        panel.style.width = width + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        saveState();
      }
    });
  }

  // Setup control buttons
  function setupControls(panel) {
    const minimizeBtn = panel.querySelector('#cxp-minimize');
    const collapseBtn = panel.querySelector('#cxp-collapse');
    const closeBtn = panel.querySelector('#cxp-close');
    const copyBtn = panel.querySelector('#cxp-copy');
    const placeBtn = panel.querySelector('#cxp-place');
    const accuracySelect = panel.querySelector('#cxp-accuracy');

    // Minimize
    minimizeBtn.addEventListener('click', () => {
      panel.classList.toggle('minimized');
      minimizeBtn.textContent = panel.classList.contains('minimized') ? '□' : '−';
      saveState();
    });

    // Collapse
    collapseBtn.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      collapseBtn.textContent = panel.classList.contains('collapsed') ? '▲' : '▼';
      saveState();
    });

    // Close (hide panel, can be reopened via extension icon)
    closeBtn.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    // Copy coords
    copyBtn.addEventListener('click', () => {
      if (!currentLat || !currentLng) return;
      const text = `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '✅ Copied!';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy Coords';
        }, 1500);
      });
    });

    // Place guess
    placeBtn.addEventListener('click', () => {
      if (!currentLat || !currentLng) return;
      const accuracy = accuracySelect.value;

      // Calculate offset
      const offset = getAccuracyOffset(accuracy);
      const guessLat = currentLat + offset.lat;
      const guessLng = currentLng + offset.lng;

      // Send to content script
      window.postMessage({
        type: 'COORDX_PLACE_GUESS',
        lat: guessLat,
        lng: guessLng,
        accuracy: accuracy
      }, '*');

      placeBtn.classList.add('placed');
      placeBtn.textContent = '✅ Placed!';

      setTimeout(() => {
        placeBtn.classList.remove('placed');
        placeBtn.textContent = '📍 Place Guess';
      }, 2000);
    });

    // Save accuracy
    accuracySelect.addEventListener('change', () => {
      localStorage.setItem('coordx_accuracy', accuracySelect.value);
      window.postMessage({
        type: 'COORDX_SETTINGS',
        accuracy: accuracySelect.value
      }, '*');
    });

    // Load saved accuracy
    const savedAccuracy = localStorage.getItem('coordx_accuracy');
    if (savedAccuracy) {
      accuracySelect.value = savedAccuracy;
    }
  }

  // Calculate accuracy offset
  function getAccuracyOffset(accuracy) {
    let minMeters, maxMeters;

    switch (accuracy) {
      case 'perfect': minMeters = 0; maxMeters = 0; break;
      case 'near': minMeters = 400; maxMeters = 800; break;
      case 'medium': minMeters = 1500; maxMeters = 3000; break;
      case 'far': minMeters = 8000; maxMeters = 15000; break;
      case 'veryfar': minMeters = 40000; maxMeters = 70000; break;
      case 'country': minMeters = 150000; maxMeters = 300000; break;
      case 'random': minMeters = 500; maxMeters = 100000; break;
      default: minMeters = 400; maxMeters = 800;
    }

    const minDeg = minMeters / 111000;
    const maxDeg = maxMeters / 111000;
    const angle = Math.random() * 2 * Math.PI;
    const distance = minDeg + Math.random() * (maxDeg - minDeg);

    return {
      lat: Math.sin(angle) * distance,
      lng: Math.cos(angle) * distance
    };
  }

  // Save/load panel state
  function saveState() {
    const panel = document.getElementById('coordx-floating-panel');
    if (!panel) return;

    const state = {
      x: panel.offsetLeft,
      y: panel.offsetTop,
      width: panel.offsetWidth,
      minimized: panel.classList.contains('minimized'),
      collapsed: panel.classList.contains('collapsed')
    };
    localStorage.setItem('coordx_panel_state', JSON.stringify(state));
  }

  function loadState() {
    const panel = document.getElementById('coordx-floating-panel');
    if (!panel) return;

    const saved = localStorage.getItem('coordx_panel_state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.x) panel.style.left = state.x + 'px';
        if (state.y) panel.style.top = state.y + 'px';
        if (state.width) panel.style.width = state.width + 'px';
        if (state.minimized) {
          panel.classList.add('minimized');
          panel.querySelector('#cxp-minimize').textContent = '□';
        }
        if (state.collapsed) {
          panel.classList.add('collapsed');
          panel.querySelector('#cxp-collapse').textContent = '▲';
        }
        panel.style.right = 'auto';
      } catch (e) {}
    }
  }

  // Update UI with new coords
  function updateCoords(lat, lng) {
    currentLat = lat;
    currentLng = lng;

    const latEl = document.getElementById('cxp-lat');
    const lngEl = document.getElementById('cxp-lng');
    const statusEl = document.getElementById('cxp-status');
    const placeBtn = document.getElementById('cxp-place');
    const placeStatus = document.getElementById('cxp-place-status');

    if (latEl) latEl.textContent = lat.toFixed(6);
    if (lngEl) lngEl.textContent = lng.toFixed(6);
    if (statusEl) {
      statusEl.textContent = 'Found!';
      statusEl.classList.add('found');
    }
    if (placeBtn) placeBtn.disabled = false;
    if (placeStatus) {
      placeStatus.textContent = 'Ready to place guess';
      placeStatus.classList.add('ready');
    }

    // Fetch address
    reverseGeocode(lat, lng);
  }

  // Country code to flag emoji
  function countryCodeToFlag(code) {
    if (!code || code.length !== 2) return '🌍';
    const base = 0x1F1E6 - 65;
    return String.fromCodePoint(code.charCodeAt(0) + base) +
           String.fromCodePoint(code.charCodeAt(1) + base);
  }

  const countryNames = {
    'US': 'USA', 'GB': 'UK', 'RU': 'Russia', 'DE': 'Germany',
    'FR': 'France', 'JP': 'Japan', 'CN': 'China', 'KR': 'S.Korea',
    'BR': 'Brazil', 'IN': 'India', 'AU': 'Australia', 'CA': 'Canada',
    'ID': 'Indonesia', 'TH': 'Thailand', 'VN': 'Vietnam', 'MY': 'Malaysia',
    'PH': 'Philippines', 'SG': 'Singapore'
  };

  // Reverse geocode
  async function reverseGeocode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' }
      });
      const data = await res.json();
      const addr = data.address || {};

      // Update address display
      const cityEl = document.getElementById('cxp-city');
      const stateEl = document.getElementById('cxp-state');
      const countryEl = document.getElementById('cxp-country');

      if (cityEl) cityEl.textContent = addr.city || addr.town || addr.village || '—';
      if (stateEl) stateEl.textContent = addr.state || '—';
      if (countryEl) countryEl.textContent = addr.country || '—';

      // Update flag
      if (addr.country_code) {
        const flagSection = document.getElementById('cxp-flag-section');
        const flagEmoji = document.getElementById('cxp-flag-emoji');
        const flagName = document.getElementById('cxp-flag-name');

        if (flagSection) flagSection.classList.add('active');
        if (flagEmoji) flagEmoji.textContent = countryCodeToFlag(addr.country_code.toUpperCase());
        if (flagName) flagName.textContent = countryNames[addr.country_code.toUpperCase()] || addr.country_code.toUpperCase();
      }
    } catch (e) {
      console.error('[CoordX] Geocode error:', e);
    }
  }

  // Listen for coords from content script
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'COORDX_COORDS') {
      const { lat, lng } = event.data;
      updateCoords(lat, lng);
    }
  });

  // Poll for coords from storage
  async function pollCoords() {
    try {
      const result = await chrome.storage.local.get(['lastCoords']);
      if (result.lastCoords) {
        const { lat, lng } = result.lastCoords;
        if (lat && lng && (lat !== currentLat || lng !== currentLng)) {
          updateCoords(lat, lng);
        }
      }
    } catch (e) {}
  }

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.lastCoords?.newValue) {
      const { lat, lng } = changes.lastCoords.newValue;
      updateCoords(lat, lng);
    }
  });

  // Initialize
  function init() {
    if (document.body) {
      createFloatingPanel();
      setInterval(pollCoords, 1000);
      pollCoords();
    } else {
      setTimeout(init, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
