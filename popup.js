/**
 * CoordX Pro — Popup Script
 * Quick-access popup from the extension icon.
 */

(function () {
  'use strict';

  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const popupCoords = document.getElementById('popupCoords');
  const popupLat = document.getElementById('popupLat');
  const popupLng = document.getElementById('popupLng');
  const openPanelBtn = document.getElementById('openPanelBtn');
  const toggleBtn = document.getElementById('toggleBtn');

  let trackingEnabled = true;

  /* ─── Init ──────────────────────────────────────────── */

  async function init() {
    const storage = await chrome.storage.local.get(['trackingEnabled', 'lastCoords']);

    trackingEnabled = storage.trackingEnabled !== false;
    updateUI(trackingEnabled);

    if (storage.lastCoords) {
      popupLat.textContent = storage.lastCoords.lat.toFixed(6);
      popupLng.textContent = storage.lastCoords.lng.toFixed(6);
      popupCoords.classList.add('visible');
    }
  }

  init();

  /* ─── Open Side Panel ───────────────────────────────── */

  openPanelBtn.addEventListener('click', async () => {
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
      window.close();
    } catch (err) {
      console.error('[CoordX Pro] Could not open side panel:', err.message);
      // Fallback: open in new tab
      chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
      window.close();
    }
  });

  /* ─── Toggle Tracking ───────────────────────────────── */

  toggleBtn.addEventListener('click', async () => {
    trackingEnabled = !trackingEnabled;

    try {
      await chrome.runtime.sendMessage({
        type: 'toggleTracking',
        enabled: trackingEnabled
      });
    } catch (e) {
      console.error('[CoordX Pro] Toggle failed:', e.message);
    }

    updateUI(trackingEnabled);
  });

  function updateUI(enabled) {
    if (enabled) {
      statusDot.classList.remove('inactive');
      statusText.textContent = 'Tracking active';
      toggleBtn.textContent = 'Pause';
    } else {
      statusDot.classList.add('inactive');
      statusText.textContent = 'Tracking paused';
      toggleBtn.textContent = 'Resume';
    }
  }

  /* ─── Live Updates ──────────────────────────────────── */

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'coordFound') {
      popupLat.textContent = message.lat.toFixed(6);
      popupLng.textContent = message.lng.toFixed(6);
      popupCoords.classList.add('visible');
    }
  });

})();
