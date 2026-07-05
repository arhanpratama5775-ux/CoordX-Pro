/**
 * CoordX Pro — Floating Panel (v2.1.0)
 *
 * Draggable & Resizable floating panel for GeoGuessr
 * Features: Mini map, toggle button, minimize only (no collapse)
 */

(function () {
  'use strict';

  // Prevent duplicate injection
  if (window.__coordxFloatingPanel) return;
  window.__coordxFloatingPanel = true;

  // Current coords
  let currentLat = null;
  let currentLng = null;
  let geocodeTimer = null;
  let panelVisible = true;
  let panelMinimized = false;

  // Extension base URL for map iframe
  const extUrl = chrome.runtime.getURL('');

  // ═══════════════════════════════════════════════════════
  // Create floating toggle button (shown when panel is hidden)
  // ═══════════════════════════════════════════════════════
  function createToggleButton() {
    const btn = document.createElement('div');
    btn.id = 'cxp-toggle-btn';
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
      <line x1="8" y1="2" x2="8" y2="18"></line>
      <line x1="16" y1="6" x2="16" y2="22"></line>
    </svg>`;
    btn.style.display = 'none';
    document.body.appendChild(btn);

    // Make toggle button draggable too
    let isDragging = false, startX, startY, initialX, initialY;

    btn.addEventListener('mousedown', (e) => {
      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;
      initialX = btn.offsetLeft;
      initialY = btn.offsetTop;

      const onMove = (e2) => {
        const dx = e2.clientX - startX;
        const dy = e2.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;
        if (isDragging) {
          btn.style.left = (initialX + dx) + 'px';
          btn.style.top = (initialY + dy) + 'px';
        }
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (!isDragging) {
          // Click — show panel
          showPanel();
        }
        saveToggleState();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    btn.addEventListener('click', () => showPanel());

    return btn;
  }

  function showPanel() {
    const panel = document.getElementById('coordx-floating-panel');
    const toggle = document.getElementById('cxp-toggle-btn');
    if (panel) {
      panel.style.display = '';
      panelVisible = true;
    }
    if (toggle) toggle.style.display = 'none';
    saveState();
  }

  function hidePanel() {
    const panel = document.getElementById('coordx-floating-panel');
    const toggle = document.getElementById('cxp-toggle-btn');
    if (panel) {
      panel.style.display = 'none';
      panelVisible = false;
    }
    if (toggle) toggle.style.display = 'flex';
    saveState();
  }

  function saveToggleState() {
    const toggle = document.getElementById('cxp-toggle-btn');
    if (!toggle) return;
    try {
      localStorage.setItem('coordx_toggle_pos', JSON.stringify({
        x: toggle.offsetLeft,
        y: toggle.offsetTop
      }));
    } catch (e) {}
  }

  function loadToggleState() {
    const toggle = document.getElementById('cxp-toggle-btn');
    if (!toggle) return;
    try {
      const saved = localStorage.getItem('coordx_toggle_pos');
      if (saved) {
        const pos = JSON.parse(saved);
        if (typeof pos.x === 'number' && typeof pos.y === 'number') {
          toggle.style.left = pos.x + 'px';
          toggle.style.top = pos.y + 'px';
        }
      }
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════
  // Create floating panel
  // ═══════════════════════════════════════════════════════
  function createFloatingPanel() {
    const panel = document.createElement('div');
    panel.id = 'coordx-floating-panel';
    panel.innerHTML = `
      <!-- Header -->
      <div id="cxp-header">
        <div id="cxp-header-left">
          <div id="cxp-logo-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
              <line x1="8" y1="2" x2="8" y2="18"></line>
              <line x1="16" y1="6" x2="16" y2="22"></line>
            </svg>
          </div>
          <div id="cxp-title-group">
            <span id="cxp-title">CoordX Pro</span>
            <span id="cxp-status">Searching...</span>
          </div>
        </div>
        <div id="cxp-controls">
          <button id="cxp-minimize" title="Minimize">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button id="cxp-close" title="Close">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div id="cxp-content">
        <!-- Coordinates -->
        <div class="cxp-section" id="cxp-coords-section">
          <div class="cxp-coords-card">
            <div class="cxp-coord">
              <span class="cxp-label">LAT</span>
              <span class="cxp-value" id="cxp-lat">--</span>
            </div>
            <div class="cxp-divider"></div>
            <div class="cxp-coord">
              <span class="cxp-label">LNG</span>
              <span class="cxp-value" id="cxp-lng">--</span>
            </div>
          </div>
          <button class="cxp-btn cxp-copy-btn" id="cxp-copy">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy Coords</span>
          </button>
        </div>

        <!-- Mini Map -->
        <div class="cxp-section cxp-map-section" id="cxp-map-section">
          <div class="cxp-section-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
              <line x1="8" y1="2" x2="8" y2="18"></line>
              <line x1="16" y1="6" x2="16" y2="22"></line>
            </svg>
            <span>Location Map</span>
          </div>
          <div class="cxp-map-card" id="cxp-map-card">
            <iframe id="cxp-map-frame" src="${extUrl}map.html" frameborder="0" allowfullscreen></iframe>
          </div>
        </div>

        <!-- Country Flag -->
        <div class="cxp-section cxp-flag-section" id="cxp-flag-section">
          <div class="cxp-flag-card">
            <span id="cxp-flag-emoji" class="cxp-flag-emoji">G</span>
            <div class="cxp-flag-info">
              <span class="cxp-flag-country" id="cxp-flag-country">--</span>
              <span class="cxp-flag-code" id="cxp-flag-code">--</span>
            </div>
          </div>
        </div>

        <!-- Address -->
        <div class="cxp-section cxp-address-section" id="cxp-address-section">
          <div class="cxp-section-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>Address</span>
          </div>
          <div class="cxp-address-card" id="cxp-address-card">
            <div class="cxp-addr-row">
              <span class="cxp-addr-label">City</span>
              <span class="cxp-addr-value" id="cxp-city">--</span>
            </div>
            <div class="cxp-addr-row">
              <span class="cxp-addr-label">State / Region</span>
              <span class="cxp-addr-value" id="cxp-state">--</span>
            </div>
            <div class="cxp-addr-row">
              <span class="cxp-addr-label">Country</span>
              <span class="cxp-addr-value" id="cxp-country">--</span>
            </div>
          </div>
        </div>

        <!-- Auto Place -->
        <div class="cxp-section cxp-autoplace-section" id="cxp-autoplace-section">
          <div class="cxp-section-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="3"></circle>
              <line x1="12" y1="2" x2="12" y2="6"></line>
              <line x1="12" y1="18" x2="12" y2="22"></line>
              <line x1="2" y1="12" x2="6" y2="12"></line>
              <line x1="18" y1="12" x2="22" y2="12"></line>
            </svg>
            <span>Auto Place</span>
          </div>
          <div class="cxp-autoplace-card">
            <div class="cxp-autoplace-row">
              <label>Accuracy</label>
              <div class="cxp-select-wrap">
                <select id="cxp-accuracy">
                  <option value="perfect">Perfect (0m)</option>
                  <option value="near">Near (400-800m)</option>
                  <option value="medium" selected>Medium (1.5-3km)</option>
                  <option value="far">Far (8-15km)</option>
                  <option value="veryfar">Very Far (40-70km)</option>
                  <option value="country">Country (150-300km)</option>
                  <option value="random">Random (0.5-100km)</option>
                </select>
                <svg class="cxp-select-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            <button class="cxp-btn cxp-btn-primary" id="cxp-place" disabled>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>Place Guess</span>
            </button>
            <div class="cxp-place-status" id="cxp-place-status">Waiting for coordinates...</div>
          </div>
        </div>
      </div>

      <!-- Resize Handle -->
      <div id="cxp-resize-handle">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="rgba(100,180,255,0.4)">
          <path d="M8 0L10 2L2 10L0 8L8 0Z"/>
          <path d="M4 0L6 2L-2 10L-4 8L4 0Z" transform="translate(4,0)"/>
        </svg>
      </div>
    `;

    // Add styles
    const styles = document.createElement('style');
    styles.textContent = getStyles();
    document.head.appendChild(styles);
    document.body.appendChild(panel);

    // Make draggable
    makeDraggable(panel);

    // Make resizable
    makeResizable(panel);

    // Setup controls
    setupControls(panel);

    // Load saved state
    loadState(panel);

    // Create toggle button
    const toggle = createToggleButton();
    loadToggleState();
  }

  function getStyles() {
    return `
      /* ═══════════════════════════════════════════════════════════
         CoordX Pro — Floating Panel Styles v2.1.0
         ═══════════════════════════════════════════════════════════ */

      /* ── Panel Base ────────────────────────────────────────── */
      #coordx-floating-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 340px;
        background: rgba(8, 10, 16, 0.96);
        border: 1px solid rgba(80, 140, 220, 0.18);
        border-radius: 14px;
        color: #dce6f0;
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
        font-size: 12px;
        line-height: 1.5;
        z-index: 2147483646;
        box-shadow:
          0 0 0 1px rgba(0, 0, 0, 0.3),
          0 12px 40px rgba(0, 0, 0, 0.55),
          0 0 60px rgba(60, 130, 220, 0.07);
        backdrop-filter: blur(20px) saturate(1.2);
        -webkit-backdrop-filter: blur(20px) saturate(1.2);
        user-select: none;
        overflow: hidden;
        animation: cxp-fadeIn 0.35s ease;
      }

      @keyframes cxp-fadeIn {
        from { opacity: 0; transform: translateY(-8px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* Minimized — only header visible */
      #coordx-floating-panel.minimized #cxp-content,
      #coordx-floating-panel.minimized #cxp-resize-handle {
        display: none;
      }
      #coordx-floating-panel.minimized {
        height: auto !important;
        border-radius: 14px;
      }

      /* ── Toggle Button ─────────────────────────────────────── */
      #cxp-toggle-btn {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 42px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(8, 10, 16, 0.95);
        border: 1px solid rgba(80, 140, 220, 0.25);
        border-radius: 12px;
        color: #4a9eff;
        cursor: pointer;
        z-index: 2147483646;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 20px rgba(60, 130, 220, 0.1);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        transition: all 0.2s ease;
        animation: cxp-fadeIn 0.25s ease;
      }

      #cxp-toggle-btn:hover {
        background: rgba(20, 30, 50, 0.95);
        border-color: rgba(60, 140, 240, 0.4);
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 30px rgba(60, 130, 220, 0.15);
        transform: scale(1.05);
      }

      #cxp-toggle-btn:active {
        transform: scale(0.95);
      }

      /* ── Header ───────────────────────────────────────────── */
      #cxp-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 11px 14px;
        background: linear-gradient(135deg, rgba(60, 120, 200, 0.12) 0%, rgba(40, 160, 220, 0.06) 100%);
        border-bottom: 1px solid rgba(80, 140, 220, 0.12);
        cursor: move;
        position: relative;
      }

      #cxp-header::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 14px;
        right: 14px;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(80, 160, 255, 0.2), transparent);
      }

      #cxp-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      #cxp-logo-wrap {
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, rgba(60, 130, 220, 0.2), rgba(40, 170, 240, 0.1));
        border-radius: 8px;
        color: #4a9eff;
        flex-shrink: 0;
      }

      #cxp-title-group {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      #cxp-title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: -0.3px;
        background: linear-gradient(135deg, #5aa8ff 0%, #38c8f0 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      #cxp-status {
        font-size: 10px;
        color: rgba(130, 150, 175, 0.8);
        font-weight: 500;
        transition: color 0.3s ease, text-shadow 0.3s ease;
      }

      #cxp-status.found {
        color: #38d4b0;
        text-shadow: 0 0 8px rgba(56, 212, 176, 0.3);
      }

      #cxp-controls {
        display: flex;
        gap: 4px;
      }

      #cxp-controls button {
        width: 26px;
        height: 26px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 6px;
        color: rgba(160, 175, 195, 0.7);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        padding: 0;
      }

      #cxp-controls button:hover {
        background: rgba(60, 130, 220, 0.2);
        border-color: rgba(60, 130, 220, 0.3);
        color: #b0d0ff;
        transform: scale(1.05);
      }

      #cxp-controls button:active {
        transform: scale(0.95);
      }

      /* ── Content ──────────────────────────────────────────── */
      #cxp-content {
        padding: 12px;
        max-height: 500px;
        overflow-y: auto;
        overflow-x: hidden;
      }

      #cxp-content::-webkit-scrollbar { width: 3px; }
      #cxp-content::-webkit-scrollbar-track { background: transparent; }
      #cxp-content::-webkit-scrollbar-thumb {
        background: rgba(60, 130, 220, 0.25);
        border-radius: 10px;
      }

      /* ── Sections ─────────────────────────────────────────── */
      .cxp-section {
        margin-bottom: 10px;
        animation: cxp-sectionIn 0.3s ease;
      }

      .cxp-section:last-child { margin-bottom: 0; }

      @keyframes cxp-sectionIn {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .cxp-section-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 10px;
        font-weight: 600;
        color: rgba(100, 170, 240, 0.8);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        margin-bottom: 7px;
      }

      .cxp-section-label svg { opacity: 0.7; }

      /* ── Coords Card ──────────────────────────────────────── */
      .cxp-coords-card {
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(12, 16, 24, 0.7);
        border: 1px solid rgba(80, 140, 220, 0.12);
        border-radius: 10px;
        padding: 14px 16px;
        margin-bottom: 8px;
        transition: border-color 0.3s ease, box-shadow 0.3s ease;
      }

      .cxp-coords-card.active {
        border-color: rgba(60, 160, 240, 0.25);
        box-shadow: 0 0 20px rgba(60, 130, 220, 0.06);
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
        font-weight: 700;
        color: rgba(80, 170, 255, 0.7);
        letter-spacing: 1.5px;
      }

      .cxp-value {
        font-size: 14px;
        font-weight: 600;
        font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
        color: #e8f2ff;
        letter-spacing: -0.2px;
      }

      .cxp-divider {
        width: 1px;
        height: 32px;
        background: linear-gradient(180deg, transparent 0%, rgba(80, 150, 240, 0.25) 50%, transparent 100%);
        margin: 0 12px;
        flex-shrink: 0;
      }

      /* ── Buttons ──────────────────────────────────────────── */
      .cxp-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 9px 14px;
        background: rgba(16, 22, 34, 0.8);
        border: 1px solid rgba(80, 140, 220, 0.15);
        border-radius: 8px;
        color: rgba(200, 215, 230, 0.85);
        font-family: inherit;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .cxp-btn:hover {
        background: rgba(20, 30, 50, 0.9);
        border-color: rgba(60, 130, 220, 0.35);
        color: #c0d8f8;
      }

      .cxp-btn:active { transform: scale(0.98); }

      .cxp-btn-primary {
        background: linear-gradient(135deg, #3a8aef 0%, #28a8d8 100%);
        border: none;
        color: white;
        font-weight: 600;
        box-shadow: 0 2px 12px rgba(58, 138, 239, 0.25);
      }

      .cxp-btn-primary:hover:not(:disabled) {
        box-shadow: 0 4px 20px rgba(58, 138, 239, 0.35);
        transform: translateY(-1px);
      }

      .cxp-btn-primary:active:not(:disabled) {
        transform: translateY(0) scale(0.98);
      }

      .cxp-btn-primary:disabled {
        background: rgba(30, 38, 52, 0.7);
        color: rgba(100, 115, 135, 0.6);
        cursor: not-allowed;
        box-shadow: none;
      }

      .cxp-btn-primary.placed {
        background: linear-gradient(135deg, #2ea65a 0%, #20b84a 100%);
        box-shadow: 0 2px 12px rgba(46, 166, 90, 0.3);
        color: white;
      }

      .cxp-copy-btn.copied {
        border-color: rgba(46, 166, 90, 0.4);
        color: #38d4a0;
      }

      .cxp-copy-btn.copied svg { stroke: #38d4a0; }

      /* ── Mini Map ─────────────────────────────────────────── */
      .cxp-map-section {}

      .cxp-map-card {
        border-radius: 10px;
        overflow: hidden;
        background: rgba(12, 16, 24, 0.7);
        border: 1px solid rgba(80, 140, 220, 0.12);
        height: 160px;
        position: relative;
      }

      .cxp-map-card iframe {
        width: 100%;
        height: 100%;
        border: none;
        display: block;
      }

      /* ── Flag Section ─────────────────────────────────────── */
      .cxp-flag-section {
        display: none;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }

      .cxp-flag-section.active {
        display: block;
        opacity: 1;
        transform: translateY(0);
      }

      .cxp-flag-card {
        display: flex;
        align-items: center;
        gap: 12px;
        background: rgba(12, 16, 24, 0.7);
        border: 1px solid rgba(80, 140, 220, 0.12);
        border-radius: 10px;
        padding: 10px 14px;
      }

      .cxp-flag-emoji {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background: rgba(30, 40, 60, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        line-height: 1;
        flex-shrink: 0;
        border: 1px solid rgba(80, 140, 220, 0.1);
      }

      .cxp-flag-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .cxp-flag-country {
        font-size: 12px;
        font-weight: 600;
        color: #dce6f0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .cxp-flag-code {
        font-size: 10px;
        color: rgba(100, 170, 240, 0.7);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* ── Address Section ──────────────────────────────────── */
      .cxp-address-section {
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }

      .cxp-address-section.active {
        opacity: 1;
        transform: translateY(0);
      }

      .cxp-address-card {
        background: rgba(12, 16, 24, 0.7);
        border: 1px solid rgba(80, 140, 220, 0.12);
        border-radius: 10px;
        overflow: hidden;
      }

      .cxp-addr-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid rgba(60, 100, 160, 0.08);
        transition: background 0.15s ease;
      }

      .cxp-addr-row:last-child { border-bottom: none; }
      .cxp-addr-row:hover { background: rgba(30, 50, 80, 0.15); }

      .cxp-addr-label {
        color: rgba(120, 140, 165, 0.8);
        font-size: 10px;
        font-weight: 500;
      }

      .cxp-addr-value {
        color: #dce6f0;
        font-size: 10.5px;
        font-weight: 500;
        max-width: 170px;
        text-align: right;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ── Auto Place ───────────────────────────────────────── */
      .cxp-autoplace-card {
        background: rgba(12, 16, 24, 0.7);
        border: 1px solid rgba(80, 140, 220, 0.12);
        border-radius: 10px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .cxp-autoplace-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }

      .cxp-autoplace-row label {
        color: rgba(140, 155, 175, 0.8);
        font-size: 10px;
        font-weight: 500;
        flex-shrink: 0;
      }

      .cxp-select-wrap {
        position: relative;
        flex: 1;
      }

      .cxp-select-wrap select {
        width: 100%;
        appearance: none;
        -webkit-appearance: none;
        background: rgba(16, 22, 34, 0.8);
        border: 1px solid rgba(80, 140, 220, 0.18);
        border-radius: 6px;
        color: #dce6f0;
        padding: 7px 28px 7px 10px;
        font-family: inherit;
        font-size: 10.5px;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      .cxp-select-wrap select:hover { border-color: rgba(60, 130, 220, 0.35); }
      .cxp-select-wrap select:focus {
        outline: none;
        border-color: rgba(60, 140, 240, 0.5);
        box-shadow: 0 0 0 2px rgba(60, 140, 240, 0.1);
      }
      .cxp-select-wrap select option { background: #0c1018; color: #dce6f0; }

      .cxp-select-chevron {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        color: rgba(100, 160, 240, 0.5);
        pointer-events: none;
      }

      .cxp-place-status {
        font-size: 9.5px;
        color: rgba(120, 140, 165, 0.7);
        text-align: center;
        font-weight: 500;
        transition: color 0.3s ease;
      }

      .cxp-place-status.ready { color: rgba(56, 212, 176, 0.9); }
      .cxp-place-status.error { color: rgba(255, 90, 90, 0.9); }

      /* ── Resize Handle ────────────────────────────────────── */
      #cxp-resize-handle {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 18px;
        height: 18px;
        cursor: nwse-resize;
        opacity: 0.4;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        transition: opacity 0.2s ease;
      }

      #cxp-resize-handle:hover { opacity: 0.8; }
    `;
  }

  // ═══════════════════════════════════════════════════════
  // Draggable
  // ═══════════════════════════════════════════════════════
  function makeDraggable(panel) {
    const header = panel.querySelector('#cxp-header');
    let isDragging = false;
    let startX, startY, initialX, initialY;

    function onPointerDown(e) {
      if (e.target.closest('button')) return;
      isDragging = true;
      const point = e.touches ? e.touches[0] : e;
      startX = point.clientX;
      startY = point.clientY;
      initialX = panel.offsetLeft;
      initialY = panel.offsetTop;
      panel.style.transition = 'none';
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const point = e.touches ? e.touches[0] : e;
      const dx = point.clientX - startX;
      const dy = point.clientY - startY;
      let newX = initialX + dx;
      let newY = initialY + dy;

      const maxX = window.innerWidth - 80;
      const maxY = window.innerHeight - 40;
      newX = Math.max(-panel.offsetWidth + 80, Math.min(maxX, newX));
      newY = Math.max(0, Math.min(maxY, newY));

      panel.style.left = newX + 'px';
      panel.style.top = newY + 'px';
      panel.style.right = 'auto';
    }

    function onPointerUp() {
      if (isDragging) {
        isDragging = false;
        panel.style.transition = '';
        saveState();
      }
    }

    header.addEventListener('mousedown', onPointerDown);
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);

    header.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);
  }

  // ═══════════════════════════════════════════════════════
  // Resizable
  // ═══════════════════════════════════════════════════════
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
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const width = startWidth - (e.clientX - startX);
      if (width >= 280 && width <= 520) {
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

  // ═══════════════════════════════════════════════════════
  // Controls
  // ═══════════════════════════════════════════════════════
  function setupControls(panel) {
    const minimizeBtn = panel.querySelector('#cxp-minimize');
    const closeBtn = panel.querySelector('#cxp-close');
    const copyBtn = panel.querySelector('#cxp-copy');
    const placeBtn = panel.querySelector('#cxp-place');
    const accuracySelect = panel.querySelector('#cxp-accuracy');

    // Minimize — toggle only
    minimizeBtn.addEventListener('click', () => {
      const isMin = panel.classList.toggle('minimized');
      panelMinimized = isMin;
      minimizeBtn.innerHTML = isMin
        ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>'
        : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
      minimizeBtn.title = isMin ? 'Expand' : 'Minimize';
      saveState();
    });

    // Close — hide panel, show toggle button
    closeBtn.addEventListener('click', () => {
      hidePanel();
    });

    // Copy coords
    copyBtn.addEventListener('click', () => {
      if (!currentLat || !currentLng) return;
      const text = currentLat.toFixed(6) + ', ' + currentLng.toFixed(6);
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.classList.add('copied');
        const span = copyBtn.querySelector('span');
        if (span) span.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          if (span) span.textContent = 'Copy Coords';
        }, 1500);
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        copyBtn.classList.add('copied');
        const span = copyBtn.querySelector('span');
        if (span) span.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          if (span) span.textContent = 'Copy Coords';
        }, 1500);
      });
    });

    // Place guess — via chrome.runtime.sendMessage
    placeBtn.addEventListener('click', async () => {
      if (!currentLat || !currentLng) return;

      const accuracy = accuracySelect.value;
      const offset = getAccuracyOffset(accuracy);
      const guessLat = currentLat + offset.lat;
      const guessLng = currentLng + offset.lng;

      const placeStatus = document.getElementById('cxp-place-status');

      placeBtn.disabled = true;
      placeBtn.querySelector('span').textContent = 'Placing...';
      if (placeStatus) {
        placeStatus.textContent = 'Sending to game...';
        placeStatus.classList.remove('error');
      }

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'placeGuess',
          lat: guessLat,
          lng: guessLng,
          accuracy: accuracy
        });

        if (response && response.success) {
          placeBtn.classList.add('placed');
          placeBtn.querySelector('span').textContent = 'Placed!';
          if (placeStatus) {
            placeStatus.textContent = 'Guess placed successfully!';
            placeStatus.classList.add('ready');
          }
          setTimeout(() => {
            placeBtn.classList.remove('placed');
            placeBtn.querySelector('span').textContent = 'Place Guess';
            placeBtn.disabled = false;
          }, 2500);
        } else {
          if (placeStatus) {
            placeStatus.textContent = 'Failed: ' + ((response && response.error) || 'Unknown error');
            placeStatus.classList.add('error');
          }
          placeBtn.querySelector('span').textContent = 'Place Guess';
          placeBtn.disabled = false;
        }
      } catch (err) {
        if (placeStatus) {
          placeStatus.textContent = 'Error: ' + (err.message || 'Connection failed');
          placeStatus.classList.add('error');
        }
        placeBtn.querySelector('span').textContent = 'Place Guess';
        placeBtn.disabled = false;
      }
    });

    // Save accuracy
    accuracySelect.addEventListener('change', () => {
      localStorage.setItem('coordx_accuracy', accuracySelect.value);
      try {
        chrome.runtime.sendMessage({
          type: 'updateAccuracy',
          accuracy: accuracySelect.value
        });
      } catch (e) {}
    });

    const savedAccuracy = localStorage.getItem('coordx_accuracy');
    if (savedAccuracy) accuracySelect.value = savedAccuracy;
  }

  // ═══════════════════════════════════════════════════════
  // Accuracy offset
  // ═══════════════════════════════════════════════════════
  function getAccuracyOffset(accuracy) {
    let minMeters, maxMeters;

    switch (accuracy) {
      case 'perfect':  minMeters = 0;      maxMeters = 0;      break;
      case 'near':     minMeters = 400;    maxMeters = 800;    break;
      case 'medium':   minMeters = 1500;   maxMeters = 3000;   break;
      case 'far':      minMeters = 8000;   maxMeters = 15000;  break;
      case 'veryfar':  minMeters = 40000;  maxMeters = 70000;  break;
      case 'country':  minMeters = 150000; maxMeters = 300000; break;
      case 'random':   minMeters = 500;    maxMeters = 100000; break;
      default:         minMeters = 400;    maxMeters = 800;
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

  // ═══════════════════════════════════════════════════════
  // Save/Load state
  // ═══════════════════════════════════════════════════════
  function saveState() {
    const panel = document.getElementById('coordx-floating-panel');
    if (!panel) return;

    try {
      localStorage.setItem('coordx_panel_state', JSON.stringify({
        x: panel.offsetLeft,
        y: panel.offsetTop,
        width: panel.offsetWidth,
        minimized: panelMinimized,
        visible: panelVisible
      }));
    } catch (e) {}
  }

  function loadState(panel) {
    if (!panel) return;

    try {
      const saved = localStorage.getItem('coordx_panel_state');
      if (saved) {
        const state = JSON.parse(saved);
        if (typeof state.x === 'number' && state.x >= 0 && state.x < window.innerWidth) {
          panel.style.left = state.x + 'px';
        }
        if (typeof state.y === 'number' && state.y >= 0 && state.y < window.innerHeight) {
          panel.style.top = state.y + 'px';
        }
        if (state.width && state.width >= 280 && state.width <= 520) {
          panel.style.width = state.width + 'px';
        }

        // Restore minimized state
        if (state.minimized) {
          panel.classList.add('minimized');
          panelMinimized = true;
          const btn = panel.querySelector('#cxp-minimize');
          if (btn) {
            btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
            btn.title = 'Expand';
          }
        }

        // Restore visibility
        if (state.visible === false) {
          hidePanel();
        }
      }
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════
  // Country code helpers
  // ═══════════════════════════════════════════════════════
  function countryCodeToFlag(code) {
    if (!code || code.length !== 2) return null;
    const base = 0x1F1E6 - 65;
    return String.fromCodePoint(code.charCodeAt(0) + base) +
           String.fromCodePoint(code.charCodeAt(1) + base);
  }

  const countryNames = {
    'US': 'United States', 'GB': 'United Kingdom', 'RU': 'Russia', 'DE': 'Germany',
    'FR': 'France', 'JP': 'Japan', 'CN': 'China', 'KR': 'South Korea',
    'BR': 'Brazil', 'IN': 'India', 'AU': 'Australia', 'CA': 'Canada',
    'IT': 'Italy', 'ES': 'Spain', 'MX': 'Mexico', 'ID': 'Indonesia',
    'NL': 'Netherlands', 'TR': 'Turkey', 'SA': 'Saudi Arabia', 'AR': 'Argentina',
    'TH': 'Thailand', 'PL': 'Poland', 'SE': 'Sweden', 'NO': 'Norway',
    'FI': 'Finland', 'DK': 'Denmark', 'BE': 'Belgium', 'AT': 'Austria',
    'CH': 'Switzerland', 'PT': 'Portugal', 'CZ': 'Czech Republic', 'GR': 'Greece',
    'HU': 'Hungary', 'RO': 'Romania', 'UA': 'Ukraine', 'VN': 'Vietnam',
    'MY': 'Malaysia', 'PH': 'Philippines', 'SG': 'Singapore', 'NZ': 'New Zealand',
    'ZA': 'South Africa', 'EG': 'Egypt', 'NG': 'Nigeria', 'IL': 'Israel',
    'AE': 'UAE', 'TW': 'Taiwan', 'HK': 'Hong Kong', 'CL': 'Chile',
    'CO': 'Colombia', 'PE': 'Peru', 'VE': 'Venezuela', 'IE': 'Ireland',
    'SK': 'Slovakia', 'BG': 'Bulgaria', 'HR': 'Croatia', 'RS': 'Serbia',
    'SI': 'Slovenia', 'EE': 'Estonia', 'LV': 'Latvia', 'LT': 'Lithuania',
    'IS': 'Iceland', 'CU': 'Cuba', 'JM': 'Jamaica', 'PA': 'Panama',
    'CR': 'Costa Rica', 'DO': 'Dominican Rep.', 'GT': 'Guatemala',
    'EC': 'Ecuador', 'BO': 'Bolivia', 'PY': 'Paraguay', 'UY': 'Uruguay',
    'MO': 'Mongolia', 'KH': 'Cambodia', 'LA': 'Laos', 'MM': 'Myanmar',
    'NP': 'Nepal', 'LK': 'Sri Lanka', 'BD': 'Bangladesh', 'PK': 'Pakistan',
    'AF': 'Afghanistan', 'IR': 'Iran', 'IQ': 'Iraq', 'JO': 'Jordan',
    'LB': 'Lebanon', 'SY': 'Syria', 'YE': 'Yemen', 'OM': 'Oman',
    'KW': 'Kuwait', 'QA': 'Qatar', 'BH': 'Bahrain', 'GE': 'Georgia',
    'AM': 'Armenia', 'AZ': 'Azerbaijan', 'KZ': 'Kazakhstan', 'UZ': 'Uzbekistan',
    'TN': 'Tunisia', 'DZ': 'Algeria', 'MA': 'Morocco', 'ET': 'Ethiopia',
    'KE': 'Kenya', 'TZ': 'Tanzania', 'GH': 'Ghana', 'SN': 'Senegal',
    'MG': 'Madagascar', 'CM': 'Cameroon'
  };

  // ═══════════════════════════════════════════════════════
  // Update UI with new coords
  // ═══════════════════════════════════════════════════════
  function updateCoords(lat, lng) {
    if (currentLat !== null && currentLng !== null) {
      if (Math.abs(lat - currentLat) < 0.0001 && Math.abs(lng - currentLng) < 0.0001) return;
    }

    currentLat = lat;
    currentLng = lng;

    const latEl = document.getElementById('cxp-lat');
    const lngEl = document.getElementById('cxp-lng');
    const statusEl = document.getElementById('cxp-status');
    const placeBtn = document.getElementById('cxp-place');
    const placeStatus = document.getElementById('cxp-place-status');
    const coordsCard = document.querySelector('.cxp-coords-card');

    if (latEl) latEl.textContent = lat.toFixed(6);
    if (lngEl) lngEl.textContent = lng.toFixed(6);
    if (statusEl) {
      statusEl.textContent = 'Location found';
      statusEl.classList.add('found');
    }
    if (coordsCard) coordsCard.classList.add('active');
    if (placeBtn) placeBtn.disabled = false;
    if (placeStatus) {
      placeStatus.textContent = 'Ready to place guess';
      placeStatus.classList.add('ready');
      placeStatus.classList.remove('error');
    }

    // Send to mini map iframe
    sendToMiniMap(lat, lng);

    // Fetch address (debounced)
    debouncedGeocode(lat, lng);
  }

  // Send coords to embedded map iframe
  function sendToMiniMap(lat, lng) {
    const frame = document.getElementById('cxp-map-frame');
    if (!frame || !frame.contentWindow) return;

    const send = () => {
      try {
        frame.contentWindow.postMessage({
          type: 'updateCoords',
          lat: lat,
          lng: lng
        }, '*');
      } catch (e) {}
    };

    send();
    setTimeout(send, 200);
    setTimeout(send, 500);
  }

  // ═══════════════════════════════════════════════════════
  // Geocoding (debounced)
  // ═══════════════════════════════════════════════════════
  function debouncedGeocode(lat, lng) {
    if (geocodeTimer) clearTimeout(geocodeTimer);
    geocodeTimer = setTimeout(() => reverseGeocode(lat, lng), 400);
  }

  async function reverseGeocode(lat, lng) {
    try {
      const url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=14&addressdetails=1';
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      const addr = data.address || {};

      const cityEl = document.getElementById('cxp-city');
      const stateEl = document.getElementById('cxp-state');
      const countryEl = document.getElementById('cxp-country');
      const addrSection = document.getElementById('cxp-address-section');

      const city = addr.city || addr.town || addr.village || '--';
      const state = addr.state || '--';
      const country = addr.country || '--';

      if (cityEl) cityEl.textContent = city;
      if (stateEl) stateEl.textContent = state;
      if (countryEl) countryEl.textContent = country;
      if (addrSection && (city !== '--' || state !== '--')) {
        addrSection.classList.add('active');
      }

      if (addr.country_code) {
        const code = addr.country_code.toUpperCase();
        const flagSection = document.getElementById('cxp-flag-section');
        const flagEmoji = document.getElementById('cxp-flag-emoji');
        const flagCountry = document.getElementById('cxp-flag-country');
        const flagCode = document.getElementById('cxp-flag-code');

        const flag = countryCodeToFlag(code);

        if (flagSection) flagSection.classList.add('active');
        if (flagEmoji) flagEmoji.textContent = flag || code;
        if (flagCountry) flagCountry.textContent = countryNames[code] || country;
        if (flagCode) flagCode.textContent = code;
      }
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════
  // Listen for coords
  // ═══════════════════════════════════════════════════════
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data) return;

    if (event.data.type === 'COORDX_COORDS') {
      const { lat, lng } = event.data;
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        updateCoords(lat, lng);
      }
    }
  });

  // Poll coords from storage
  async function pollCoords() {
    try {
      const result = await chrome.storage.local.get(['lastCoords']);
      if (result.lastCoords) {
        const { lat, lng } = result.lastCoords;
        if (lat && lng) updateCoords(lat, lng);
      }
    } catch (e) {}
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.lastCoords && changes.lastCoords.newValue) {
      const { lat, lng } = changes.lastCoords.newValue;
      if (lat && lng) updateCoords(lat, lng);
    }
  });

  // ═══════════════════════════════════════════════════════
  // Init
  // ═══════════════════════════════════════════════════════
  function init() {
    if (document.body) {
      createFloatingPanel();
      setInterval(pollCoords, 1500);
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