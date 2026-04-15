/**
 * CoordX Pro — Side Panel Script (v1.5.5)
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
  let lastLogTime = 0;

  /* ─── Rate-limited Log ───────────────────────────────── */

  function log(msg) {
    console.log('[CoordX Pro]', msg);
    const now = Date.now();
    if (now - lastLogTime > 500) {
      lastLogTime = now;
      chrome.runtime.sendMessage({ 
        type: 'log', 
        message: '[SIDE] ' + msg, 
        time: new Date().toISOString() 
      }).catch(() => {});
    }
  }

  log('🚀 Side panel v1.5.5 loaded');

  /* ─── Initialize ────────────────────────────────────── */

  async function init() {
    const storage = await chrome.storage.local.get(['trackingEnabled', 'lastCoords']);

    if (storage.trackingEnabled !== undefined) {
      els.trackingToggle.checked = storage.trackingEnabled;
    }

    if (storage.lastCoords) {
      currentCoords = storage.lastCoords;
      updateUI(storage.lastCoords.lat, storage.lastCoords.lng);
    } else {
      els.statusText.textContent = 'Searching for location...';
    }

    loadLogs();
    setInterval(loadLogs, 2000);
  }

  init();

  /* ─── Logs Management ───────────────────────────────── */

  async function loadLogs() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getLogs' });
      const logs = response?.logs || [];
      
      els.logCount.textContent = logs.length;
      
      if (logs.length === 0) {
        els.logsContent.innerHTML = '<div class="log-empty">No logs yet.</div>';
        return;
      }
      
      const recentLogs = logs.slice(-30);
      els.logsContent.innerHTML = recentLogs.map(log => {
        const time = log.time.split('T')[1]?.split('.')[0] || log.time;
        const msg = escapeHtml(log.message);
        return `<div class="log-entry"><span class="log-time">${time}</span> ${msg}</div>`;
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

  els.refreshLogsBtn.addEventListener('click', loadLogs);

  els.clearLogsBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'clearLogs' });
    loadLogs();
  });

  /* ─── UI Update ─────────────────────────────────────── */

  function updateUI(lat, lng) {
    log('✅ UI update: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
    
    currentCoords = { lat, lng };
    
    // Update coords display
    els.latValue.textContent = lat.toFixed(6);
    els.lngValue.textContent = lng.toFixed(6);
    els.coordSection.classList.add('active');
    
    // Update status
    els.statusText.textContent = 'Location found!';
    els.statusText.classList.add('found');
    els.statusText.classList.remove('paused');
    
    // Update map
    if (els.mapFrame?.contentWindow) {
      els.mapFrame.contentWindow.postMessage({
        type: 'updateCoords',
        lat, lng
      }, '*');
    }
    
    // Fetch geocoding
    reverseGeocode(lat, lng);
  }

  /* ─── Message Listener ──────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'coordFound') {
      log('📨 coordFound: ' + message.lat?.toFixed?.(4) + ', ' + message.lng?.toFixed?.(4));
      updateUI(message.lat, message.lng);
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    
    if (changes.lastCoords?.newValue) {
      const { lat, lng } = changes.lastCoords.newValue;
      log('📦 Storage: ' + lat?.toFixed?.(4) + ', ' + lng?.toFixed?.(4));
      updateUI(lat, lng);
    }
  });

  /* ─── Reverse Geocoding ─────────────────────────────── */

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

        if (!response.ok) throw new Error('HTTP ' + response.status);

        const data = await response.json();
        
        if (data.error) throw new Error(data.error);

        const addr = data.address || {};
        
        els.addrDisplayName.textContent = data.display_name || 'Unknown';
        els.addrNeighborhood.textContent = addr.neighbourhood || addr.hamlet || '—';
        els.addrSuburb.textContent = addr.suburb || addr.village || '—';
        els.addrCity.textContent = addr.city || addr.town || addr.municipality || '—';
        els.addrDistrict.textContent = addr.state_district || addr.county || '—';
        els.addrState.textContent = addr.state || addr.region || '—';
        els.addrPostcode.textContent = addr.postcode || '—';
        els.addrCountry.textContent = addr.country || '—';
        
        if (els.addrDisplayName.textContent.length > 80) {
          els.addrDisplayName.textContent = els.addrDisplayName.textContent.substring(0, 77) + '...';
        }

      } catch (err) {
        els.addrDisplayName.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        els.addrCountry.textContent = 'Address lookup failed';
      }
    }, 300);
  }

  /* ─── Toggle Tracking ───────────────────────────────── */

  els.trackingToggle.addEventListener('change', async () => {
    const enabled = els.trackingToggle.checked;
    await chrome.runtime.sendMessage({ type: 'toggleTracking', enabled });
    els.statusText.textContent = enabled ? 'Searching for location...' : 'Tracking paused';
    els.statusText.classList.remove('found');
    els.statusText.classList.toggle('paused', !enabled);
  });

  /* ─── Reset ─────────────────────────────────────────── */

  els.resetBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'resetSearch' });

    currentCoords = null;
    els.latValue.textContent = '—';
    els.lngValue.textContent = '—';
    els.coordSection.classList.remove('active');
    els.statusText.textContent = 'Searching for location...';
    els.statusText.classList.remove('found', 'paused');

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
  });

  /* ─── Copy Coordinates ──────────────────────────────── */

  els.copyCoordsBtn.addEventListener('click', () => {
    if (!currentCoords) return;

    const text = `${currentCoords.lat.toFixed(6)}, ${currentCoords.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text).then(() => {
      els.copyCoordsBtn.classList.add('copied');
      els.copyCoordsBtn.querySelector('span').textContent = 'Copied!';
      setTimeout(() => {
        els.copyCoordsBtn.classList.remove('copied');
        els.copyCoordsBtn.querySelector('span').textContent = 'Copy Coords';
      }, 1500);
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  });

})();
