/**
 * CoordX Pro — Side Panel Script (v1.7.6)
 */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const els = {
    statusText: $('statusText'),
    trackingToggle: $('trackingToggle'),
    coordSection: $('coordSection'),
    latValue: $('latValue'),
    lngValue: $('lngValue'),
    copyCoordsBtn: $('copyCoordsBtn'),
    addressSection: $('addressSection'),
    addrDisplayName: $('addrDisplayName'),
    addrNeighborhood: $('addrNeighborhood'),
    addrSuburb: $('addrSuburb'),
    addrCity: $('addrCity'),
    addrDistrict: $('addrDistrict'),
    addrState: $('addrState'),
    addrPostcode: $('addrPostcode'),
    addrCountry: $('addrCountry'),
    mapFrame: $('mapFrame'),
    resetBtn: $('resetBtn'),
    logsSection: $('logsSection'),
    logsToggle: $('logsToggle'),
    logsContainer: $('logsContainer'),
    logsContent: $('logsContent'),
    logCount: $('logCount'),
    refreshLogsBtn: $('refreshLogsBtn'),
    clearLogsBtn: $('clearLogsBtn')
  };

  let currentCoords = null;
  let geocodeTimeout = null;
  let logsVisible = false;
  let currentLat = null;
  let currentLng = null;

  console.log('[CoordX Pro] Side panel v1.7.6 loaded');

  /* ─── Init ───────────────────────────────────────────── */

  async function init() {
    const storage = await chrome.storage.local.get(['trackingEnabled', 'lastCoords']);

    if (storage.trackingEnabled !== undefined) {
      els.trackingToggle.checked = storage.trackingEnabled;
    }

    if (storage.lastCoords) {
      const { lat, lng } = storage.lastCoords;
      if (lat && lng) {
        updateUI(lat, lng);
      }
    } else {
      els.statusText.textContent = 'Searching...';
    }

    loadLogs();
    setInterval(loadLogs, 2000);
    
    // Also poll for coords in case storage change missed
    setInterval(checkCoords, 3000);
  }

  init();

  /* ─── Check coords periodically ──────────────────────── */

  async function checkCoords() {
    try {
      const storage = await chrome.storage.local.get(['lastCoords']);
      if (storage.lastCoords) {
        const { lat, lng } = storage.lastCoords;
        if (lat && lng && (lat !== currentLat || lng !== currentLng)) {
          updateUI(lat, lng);
        }
      }
    } catch (e) {}
  }

  /* ─── Logs ───────────────────────────────────────────── */

  async function loadLogs() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getLogs' });
      const logs = response?.logs || [];
      els.logCount.textContent = logs.length;
      
      if (logs.length === 0) {
        els.logsContent.innerHTML = '<div class="log-empty">No logs yet. Start a game!</div>';
        return;
      }
      
      els.logsContent.innerHTML = logs.slice(-20).map(log => {
        const time = log.time.split('T')[1]?.split('.')[0] || '';
        return `<div class="log-entry"><span class="log-time">${time}</span> ${escapeHtml(log.message)}</div>`;
      }).join('');
    } catch (e) {}
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  els.logsToggle.addEventListener('click', () => {
    logsVisible = !logsVisible;
    els.logsContainer.style.display = logsVisible ? 'block' : 'none';
    if (logsVisible) loadLogs();
  });

  els.refreshLogsBtn.addEventListener('click', () => {
    loadLogs();
    // Also trigger content script re-check
    chrome.runtime.sendMessage({ type: 'forceUpdate' });
  });

  els.clearLogsBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'clearLogs' });
    loadLogs();
  });

  /* ─── UI Update ──────────────────────────────────────── */

  function updateUI(lat, lng) {
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
    
    console.log('[CoordX Pro] Update UI:', lat, lng);
    
    currentLat = lat;
    currentLng = lng;
    currentCoords = { lat, lng };
    
    // Update coords display
    els.latValue.textContent = lat.toFixed(6);
    els.lngValue.textContent = lng.toFixed(6);
    els.coordSection.classList.add('active');
    
    // Update status
    els.statusText.textContent = 'Found!';
    els.statusText.classList.add('found');
    
    // Send to map iframe
    const sendToMap = () => {
      if (els.mapFrame?.contentWindow) {
        els.mapFrame.contentWindow.postMessage({
          type: 'updateCoords',
          lat: lat,
          lng: lng
        }, '*');
      }
    };
    
    sendToMap();
    setTimeout(sendToMap, 100);
    setTimeout(sendToMap, 300);
    setTimeout(sendToMap, 500);
    
    // Fetch geocoding
    reverseGeocode(lat, lng);
  }

  /* ─── Listen for Storage Changes ─────────────────────── */

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    
    if (changes.lastCoords?.newValue) {
      const { lat, lng } = changes.lastCoords.newValue;
      if (lat && lng) {
        updateUI(lat, lng);
      }
    }
  });

  /* ─── Geocoding ──────────────────────────────────────── */

  async function reverseGeocode(lat, lng) {
    els.addrDisplayName.textContent = 'Loading...';
    els.addressSection.classList.add('active');
    
    if (geocodeTimeout) clearTimeout(geocodeTimeout);

    geocodeTimeout = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json', 'Accept-Language': 'en' }
        });

        const data = await response.json();
        const addr = data.address || {};
        
        els.addrDisplayName.textContent = data.display_name || 'Unknown';
        els.addrNeighborhood.textContent = addr.neighbourhood || addr.hamlet || '—';
        els.addrSuburb.textContent = addr.suburb || addr.village || '—';
        els.addrCity.textContent = addr.city || addr.town || '—';
        els.addrDistrict.textContent = addr.state_district || addr.county || '—';
        els.addrState.textContent = addr.state || '—';
        els.addrPostcode.textContent = addr.postcode || '—';
        els.addrCountry.textContent = addr.country || '—';
        
        if (els.addrDisplayName.textContent.length > 80) {
          els.addrDisplayName.textContent = els.addrDisplayName.textContent.substring(0, 77) + '...';
        }
      } catch (err) {
        els.addrDisplayName.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        els.addrCountry.textContent = 'Lookup failed';
      }
    }, 300);
  }

  /* ─── Controls ───────────────────────────────────────── */

  els.trackingToggle.addEventListener('change', async () => {
    const enabled = els.trackingToggle.checked;
    await chrome.runtime.sendMessage({ type: 'toggleTracking', enabled });
    els.statusText.textContent = enabled ? 'Searching...' : 'Paused';
    els.statusText.classList.toggle('paused', !enabled);
  });

  els.resetBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'resetSearch' });
    currentCoords = null;
    currentLat = null;
    currentLng = null;
    els.latValue.textContent = '—';
    els.lngValue.textContent = '—';
    els.coordSection.classList.remove('active');
    els.statusText.textContent = 'Searching...';
    els.statusText.classList.remove('found');
    
    els.addrDisplayName.textContent = '—';
    els.addrNeighborhood.textContent = '—';
    els.addrSuburb.textContent = '—';
    els.addrCity.textContent = '—';
    els.addrDistrict.textContent = '—';
    els.addrState.textContent = '—';
    els.addrPostcode.textContent = '—';
    els.addrCountry.textContent = '—';
    els.addressSection.classList.remove('active');

    if (els.mapFrame?.contentWindow) {
      els.mapFrame.contentWindow.postMessage({ type: 'resetMap' }, '*');
    }
    
    // Trigger re-check
    chrome.runtime.sendMessage({ type: 'forceUpdate' });
  });

  els.copyCoordsBtn.addEventListener('click', () => {
    if (!currentCoords) return;
    const text = `${currentCoords.lat.toFixed(6)}, ${currentCoords.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text).then(() => {
      els.copyCoordsBtn.classList.add('copied');
      els.copyCoordsBtn.querySelector('span').textContent = 'Copied!';
      setTimeout(() => {
        els.copyCoordsBtn.classList.remove('copied');
        els.copyCoordsBtn.querySelector('span').textContent = 'Copy';
      }, 1500);
    });
  });

})();
