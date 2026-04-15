/**
 * CoordX Pro — Side Panel Script (v1.4.0)
 * 
 * - Added in-extension logging viewer
 * - FIX: Restore coords from storage on open, but always fetch new geocoding
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
    // Logs
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

  console.log('[CoordX Pro] Side panel v1.4.0 loaded');

  /* ─── Initialize ────────────────────────────────────── */

  async function init() {
    console.log('[CoordX Pro] Initializing...');
    
    const storage = await chrome.storage.local.get(['trackingEnabled', 'lastCoords']);

    if (storage.trackingEnabled !== undefined) {
      els.trackingToggle.checked = storage.trackingEnabled;
    }

    // Restore coords if available (but NOT address - we'll fetch fresh)
    if (storage.lastCoords) {
      console.log('[CoordX Pro] Restoring coords:', storage.lastCoords);
      currentCoords = storage.lastCoords;
      updateCoordinates(storage.lastCoords.lat, storage.lastCoords.lng);
      els.statusText.textContent = 'Location found!';
      els.statusText.classList.add('found');
      postToMap(storage.lastCoords.lat, storage.lastCoords.lng);
      
      // Always fetch fresh geocoding
      reverseGeocode(storage.lastCoords.lat, storage.lastCoords.lng);
    } else {
      els.statusText.textContent = 'Searching for location...';
    }

    // Load logs
    loadLogs();
    
    // Auto-refresh logs every 2 seconds
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
      
      // Show last 50 logs (newest at bottom)
      const recentLogs = logs.slice(-50);
      els.logsContent.innerHTML = recentLogs.map(log => {
        const time = log.time.split('T')[1]?.split('.')[0] || log.time;
        const msg = escapeHtml(log.message);
        const isError = msg.includes('error') || msg.includes('Error') || msg.includes('⚠️');
        const isSuccess = msg.includes('✅') || msg.includes('NEW COORDS');
        const className = isError ? 'log-error' : isSuccess ? 'log-success' : '';
        return `<div class="log-entry ${className}"><span class="log-time">${time}</span> ${msg}</div>`;
      }).join('');
      
      // Auto-scroll to bottom only if enabled
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

  let autoScrollEnabled = false;

  // Toggle logs visibility
  els.logsToggle.addEventListener('click', () => {
    logsVisible = !logsVisible;
    els.logsContainer.style.display = logsVisible ? 'block' : 'none';
    if (logsVisible) {
      loadLogs();
    }
  });

  // Toggle auto-scroll
  els.logsContent.addEventListener('click', () => {
    autoScrollEnabled = !autoScrollEnabled;
    els.logsContent.style.borderColor = autoScrollEnabled ? 'var(--success)' : 'var(--border-color)';
  });

  // Refresh logs button
  els.refreshLogsBtn.addEventListener('click', () => {
    loadLogs();
  });

  // Clear logs button
  els.clearLogsBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'clearLogs' });
    loadLogs();
  });

  /* ─── Coordinate Update Handler ─────────────────────── */

  function handleNewCoords(lat, lng, source) {
    // Check if this is actually new coords
    const isNew = !currentCoords || 
        Math.abs(currentCoords.lat - lat) > 0.0001 ||
        Math.abs(currentCoords.lng - lng) > 0.0001;

    console.log(`[CoordX Pro] ✅ Coords from ${source}:`, lat, lng, isNew ? '(NEW)' : '(same)');
    
    currentCoords = { lat, lng };

    // ALWAYS update UI and map (even for same coords - might be new round)
    updateCoordinates(lat, lng);
    postToMap(lat, lng);
    
    els.statusText.textContent = 'Location found!';
    els.statusText.classList.add('found');
    els.statusText.classList.remove('paused');
    
    // Fetch geocoding for new coords
    if (isNew) {
      reverseGeocode(lat, lng);
    }
  }

  /* ─── Message Listener ──────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'coordFound') {
      handleNewCoords(message.lat, message.lng, message.source || 'message');
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.lastCoords && changes.lastCoords.newValue) {
      const { lat, lng } = changes.lastCoords.newValue;
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
    if (!mapFrame) {
      console.warn('[CoordX Pro] Map frame not found');
      return;
    }

    // Try multiple times to ensure message is received
    const sendMsg = () => {
      if (mapFrame.contentWindow) {
        mapFrame.contentWindow.postMessage({
          type: 'updateCoords',
          lat,
          lng
        }, '*');
        console.log('[CoordX Pro] Message sent to map');
      }
    };

    // Send immediately
    sendMsg();
    
    // Also send after short delays (in case iframe is loading)
    setTimeout(sendMsg, 100);
    setTimeout(sendMsg, 300);
  }

  /* ─── Reverse Geocoding ─────────────────────────────── */

  async function reverseGeocode(lat, lng) {
    console.log('[CoordX Pro] 🌍 Geocoding:', lat, lng);
    
    // Clear old address and show loading
    els.addrDisplayName.textContent = 'Loading address...';
    els.addrNeighborhood.textContent = '—';
    els.addrSuburb.textContent = '—';
    els.addrCity.textContent = '—';
    els.addrDistrict.textContent = '—';
    els.addrState.textContent = '—';
    els.addrPostcode.textContent = '—';
    els.addrCountry.textContent = '—';
    els.addressSection.classList.add('active');
    
    // Debounce
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
        console.log('[CoordX Pro] Geocode result:', data);
        
        if (data.error) throw new Error(data.error);

        const address = parseAddress(data);
        updateAddressUI(address);

        // Save to storage
        chrome.storage.local.set({ lastAddress: address });

      } catch (err) {
        console.error('[CoordX Pro] Geocoding failed:', err.message);
        
        // Show coords as fallback
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
