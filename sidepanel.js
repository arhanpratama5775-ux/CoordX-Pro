/**
 * CoordX Pro — Side Panel Script (v1.5.3)
 */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  /* ─── Logging to Extension Logs ───────────────────────── */

  async function logToExtension(message) {
    const time = new Date().toISOString();
    console.log('[CoordX Pro]', message);
    try {
      await chrome.runtime.sendMessage({ type: 'log', message: '[SIDE] ' + message, time });
    } catch (e) {}
  }

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
  let autoScrollEnabled = false;

  logToExtension('🚀 Side panel v1.5.3 loaded');

  /* ─── Initialize ────────────────────────────────────── */

  async function init() {
    logToExtension('Initializing...');
    
    const storage = await chrome.storage.local.get(['trackingEnabled', 'lastCoords']);

    if (storage.trackingEnabled !== undefined) {
      els.trackingToggle.checked = storage.trackingEnabled;
    }

    if (storage.lastCoords) {
      logToExtension('Restoring coords from storage: ' + storage.lastCoords.lat?.toFixed?.(4) + ', ' + storage.lastCoords.lng?.toFixed?.(4));
      currentCoords = storage.lastCoords;
      updateCoordinates(storage.lastCoords.lat, storage.lastCoords.lng);
      els.statusText.textContent = 'Location found!';
      els.statusText.classList.add('found');
      postToMap(storage.lastCoords.lat, storage.lastCoords.lng);
      reverseGeocode(storage.lastCoords.lat, storage.lastCoords.lng);
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
        els.logsContent.innerHTML = '<div class="log-empty">No logs yet. Start a game to see debug info.</div>';
        return;
      }
      
      const recentLogs = logs.slice(-50);
      els.logsContent.innerHTML = recentLogs.map(log => {
        const time = log.time.split('T')[1]?.split('.')[0] || log.time;
        const msg = escapeHtml(log.message);
        const isError = msg.includes('error') || msg.includes('Error') || msg.includes('⚠️') || msg.includes('❌');
        const isSuccess = msg.includes('✅') || msg.includes('SENDING');
        const className = isError ? 'log-error' : isSuccess ? 'log-success' : '';
        return `<div class="log-entry ${className}"><span class="log-time">${time}</span> ${msg}</div>`;
      }).join('');
      
      if (autoScrollEnabled) {
        els.logsContent.scrollTop = els.logsContent.scrollHeight;
      }
    } catch (e) {
      console.error('[CoordX Pro] Failed to load logs:', e);
    }
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

  els.logsContent.addEventListener('click', () => {
    autoScrollEnabled = !autoScrollEnabled;
    els.logsContent.style.borderColor = autoScrollEnabled ? 'var(--success)' : 'var(--border-color)';
  });

  els.refreshLogsBtn.addEventListener('click', loadLogs);

  els.clearLogsBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'clearLogs' });
    loadLogs();
  });

  /* ─── Coordinate Update Handler ─────────────────────── */

  function handleNewCoords(lat, lng, source) {
    logToExtension('📍 handleNewCoords called: ' + lat?.toFixed?.(4) + ', ' + lng?.toFixed?.(4) + ' from ' + source);

    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
      logToExtension('❌ Invalid coords received: ' + lat + ', ' + lng);
      return;
    }

    // ALWAYS update - user might be on a new round
    currentCoords = { lat, lng };
    logToExtension('✅ Updating UI with new coords');

    // Update UI
    updateCoordinates(lat, lng);
    postToMap(lat, lng);
    
    els.statusText.textContent = 'Location found!';
    els.statusText.classList.add('found');
    els.statusText.classList.remove('paused');
    
    // Always fetch fresh geocoding
    reverseGeocode(lat, lng);
  }

  /* ─── Message Listener ──────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logToExtension('📨 Received message: ' + message.type);
    if (message.type === 'coordFound') {
      logToExtension('🎉 coordFound message! Lat: ' + message.lat + ', Lng: ' + message.lng);
      handleNewCoords(message.lat, message.lng, message.source || 'message');
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    logToExtension('📦 Storage changed: ' + Object.keys(changes).join(', '));

    if (changes.lastCoords && changes.lastCoords.newValue) {
      const { lat, lng } = changes.lastCoords.newValue;
      logToExtension('🔄 lastCoords changed! New: ' + lat?.toFixed?.(4) + ', ' + lng?.toFixed?.(4));
      handleNewCoords(lat, lng, 'storage');
    }
  });

  /* ─── Coordinate Display ────────────────────────────── */

  function updateCoordinates(lat, lng) {
    els.latValue.textContent = lat.toFixed(6);
    els.lngValue.textContent = lng.toFixed(6);
    els.coordSection.classList.add('active');
  }

  /* ─── Map Communication ─────────────────────────────── */

  function postToMap(lat, lng) {
    console.log('[CoordX Pro] Sending to map:', lat, lng);
    
    const mapFrame = els.mapFrame;
    if (!mapFrame) return;

    const sendMsg = () => {
      if (mapFrame.contentWindow) {
        mapFrame.contentWindow.postMessage({
          type: 'updateCoords',
          lat, lng
        }, '*');
      }
    };

    sendMsg();
    setTimeout(sendMsg, 100);
    setTimeout(sendMsg, 300);
  }

  /* ─── Reverse Geocoding ─────────────────────────────── */

  async function reverseGeocode(lat, lng) {
    console.log('[CoordX Pro] 🌍 Geocoding:', lat, lng);
    
    els.addrDisplayName.textContent = 'Loading address...';
    els.addrNeighborhood.textContent = '—';
    els.addrSuburb.textContent = '—';
    els.addrCity.textContent = '—';
    els.addrDistrict.textContent = '—';
    els.addrState.textContent = '—';
    els.addrPostcode.textContent = '—';
    els.addrCountry.textContent = '—';
    els.addressSection.classList.add('active');
    
    if (geocodeTimeout) clearTimeout(geocodeTimeout);

    geocodeTimeout = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        
        const response = await fetch(url, {
          headers: { 
            'Accept': 'application/json',
            'Accept-Language': 'en'
          }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        
        if (data.error) throw new Error(data.error);

        const address = parseAddress(data);
        updateAddressUI(address);
        chrome.storage.local.set({ lastAddress: address });

      } catch (err) {
        console.error('[CoordX Pro] Geocoding failed:', err.message);
        updateAddressUI({
          displayName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          neighborhood: '—',
          suburb: '—',
          city: '—',
          district: '—',
          state: '—',
          postcode: '—',
          country: 'Address lookup failed'
        });
      }
    }, 300);
  }

  function parseAddress(data) {
    const addr = data.address || {};
    
    return {
      displayName: data.display_name || 'Unknown',
      neighborhood: addr.neighbourhood || addr.hamlet || '—',
      suburb: addr.suburb || addr.village || '—',
      city: addr.city || addr.town || addr.municipality || '—',
      district: addr.state_district || addr.county || '—',
      state: addr.state || addr.region || '—',
      postcode: addr.postcode || '—',
      country: addr.country || '—'
    };
  }

  function updateAddressUI(address) {
    els.addrDisplayName.textContent = address.displayName;
    els.addrNeighborhood.textContent = address.neighborhood;
    els.addrSuburb.textContent = address.suburb;
    els.addrCity.textContent = address.city;
    els.addrDistrict.textContent = address.district;
    els.addrState.textContent = address.state;
    els.addrPostcode.textContent = address.postcode;
    els.addrCountry.textContent = address.country;
    els.addressSection.classList.add('active');

    if (address.displayName && address.displayName.length > 80) {
      els.addrDisplayName.textContent = address.displayName.substring(0, 77) + '...';
      els.addrDisplayName.title = address.displayName;
    }
  }

  /* ─── Toggle Tracking ───────────────────────────────── */

  els.trackingToggle.addEventListener('change', async () => {
    const enabled = els.trackingToggle.checked;
    await chrome.runtime.sendMessage({ type: 'toggleTracking', enabled });
    els.statusText.textContent = enabled ? 'Searching for location...' : 'Tracking paused';
    els.statusText.classList.remove('found');
    els.statusText.classList.toggle('paused', !enabled);
  });

  /* ─── Reset (New Round) ─────────────────────────────── */

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

    if (els.mapFrame.contentWindow) {
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
