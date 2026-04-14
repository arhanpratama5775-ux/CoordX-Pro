/**
 * CoordX Pro — Side Panel Script (v1.0.9)
 * 
 * Handles:
 * - Receiving coordinate updates from background worker
 * - Reverse geocoding via Nominatim API
 * - Communicating with the map iframe
 * - Toggle and reset functionality
 * - Copy-to-clipboard for coordinates
 */

(function () {
  'use strict';

  /* ─── DOM References ────────────────────────────────── */

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
    resetBtn: $('resetBtn')
  };

  let currentCoords = null;
  let geocodeTimeout = null;

  console.log('[CoordX Pro] Side panel v1.0.9 loaded');

  /* ─── Initialize ────────────────────────────────────── */

  async function init() {
    console.log('[CoordX Pro] Initializing side panel...');
    
    const storage = await chrome.storage.local.get(['trackingEnabled', 'lastCoords', 'lastAddress']);

    if (storage.trackingEnabled !== undefined) {
      els.trackingToggle.checked = storage.trackingEnabled;
    }

    // Restore last coordinates if available
    if (storage.lastCoords) {
      console.log('[CoordX Pro] Restoring coords from storage:', storage.lastCoords);
      currentCoords = storage.lastCoords;
      updateCoordinates(storage.lastCoords.lat, storage.lastCoords.lng);
      els.statusText.textContent = 'Location found!';
      els.statusText.classList.add('found');
      postToMap(storage.lastCoords.lat, storage.lastCoords.lng);

      // Restore or fetch address
      if (storage.lastAddress) {
        console.log('[CoordX Pro] Restoring address from storage');
        updateAddressUI(storage.lastAddress);
      } else {
        console.log('[CoordX Pro] No address in storage, fetching...');
        reverseGeocode(storage.lastCoords.lat, storage.lastCoords.lng);
      }
    }

    // Request current status from background
    try {
      const status = await chrome.runtime.sendMessage({ type: 'getStatus' });
      console.log('[CoordX Pro] Background status:', status);
      
      if (status.lastCoords && !currentCoords) {
        currentCoords = status.lastCoords;
        updateCoordinates(status.lastCoords.lat, status.lastCoords.lng);
        postToMap(status.lastCoords.lat, status.lastCoords.lng);
        reverseGeocode(status.lastCoords.lat, status.lastCoords.lng);
        els.statusText.textContent = 'Location found!';
        els.statusText.classList.add('found');
      }
      if (status.searching && !currentCoords) {
        els.statusText.textContent = 'Searching for location...';
        els.statusText.classList.remove('found');
      }
    } catch (e) {
      console.warn('[CoordX Pro] Could not get status:', e.message);
    }
  }

  init();

  /* ─── Coordinate Update Handler ─────────────────────── */

  function handleNewCoords(lat, lng, source) {
    // Skip if we already have these exact coordinates
    if (currentCoords && 
        Math.abs(currentCoords.lat - lat) < 0.0001 && 
        Math.abs(currentCoords.lng - lng) < 0.0001) {
      console.log(`[CoordX Pro] Duplicate coord update from ${source}, skipping`);
      return;
    }

    console.log(`[CoordX Pro] ✅ New coords from ${source}:`, lat, lng);
    currentCoords = { lat, lng };

    // Update UI immediately with coordinates
    updateCoordinates(lat, lng);
    postToMap(lat, lng);
    
    els.statusText.textContent = 'Location found!';
    els.statusText.classList.add('found');
    els.statusText.classList.remove('paused');
    
    // Then try geocoding (don't block UI)
    reverseGeocode(lat, lng);
  }

  /* ─── Message Listener ──────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'coordFound') {
      handleNewCoords(message.lat, message.lng, 'message');
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
    const mapFrame = els.mapFrame;
    
    const sendMsg = () => {
      if (mapFrame.contentWindow) {
        mapFrame.contentWindow.postMessage({
          type: 'updateCoords',
          lat,
          lng
        }, '*');
        console.log('[CoordX Pro] Sent coords to map');
      }
    };

    if (mapFrame.contentDocument && mapFrame.contentDocument.readyState === 'complete') {
      sendMsg();
    } else {
      mapFrame.addEventListener('load', sendMsg, { once: true });
    }
  }

  /* ─── Reverse Geocoding ─────────────────────────────── */

  async function reverseGeocode(lat, lng) {
    console.log('[CoordX Pro] 🌍 Starting reverse geocode for:', lat, lng);
    
    // Show loading state
    els.addrDisplayName.textContent = 'Looking up address...';
    els.addrNeighborhood.textContent = '—';
    els.addrSuburb.textContent = '—';
    els.addrCity.textContent = '—';
    els.addrDistrict.textContent = '—';
    els.addrState.textContent = '—';
    els.addrPostcode.textContent = '—';
    els.addrCountry.textContent = '—';
    els.addressSection.classList.add('active');
    
    // Debounce rapid calls
    if (geocodeTimeout) clearTimeout(geocodeTimeout);

    geocodeTimeout = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        
        console.log('[CoordX Pro] Fetching geocode...');
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 
            'Accept': 'application/json',
            'Accept-Language': 'en'
          }
        });

        console.log('[CoordX Pro] Geocode response status:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('[CoordX Pro] Geocode data:', data);
        
        if (data.error) {
          throw new Error(data.error);
        }

        const address = parseAddress(data);
        console.log('[CoordX Pro] Parsed address:', address);
        
        updateAddressUI(address);

        // Persist address for panel reopen
        chrome.storage.local.set({ lastAddress: address }).catch(() => {});

      } catch (err) {
        console.error('[CoordX Pro] Geocoding failed:', err.message);
        
        // Show coordinates as fallback - at least user can see where they are
        updateAddressUI({
          displayName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          neighborhood: 'Address lookup failed',
          suburb: '—',
          city: '—',
          district: '—',
          state: '—',
          postcode: '—',
          country: 'See coordinates above'
        });
      }
    }, 500);
  }

  function parseAddress(data) {
    const addr = data.address || {};
    
    return {
      displayName: data.display_name || 'Unknown location',
      neighborhood: addr.neighbourhood || addr.hamlet || addr.residential || '—',
      suburb: addr.suburb || addr.village || addr.quarter || '—',
      city: addr.city || addr.town || addr.municipality || '—',
      district: addr.state_district || addr.county || '—',
      state: addr.state || addr.region || addr.province || '—',
      postcode: addr.postcode || '—',
      country: addr.country || '—'
    };
  }

  function updateAddressUI(address) {
    console.log('[CoordX Pro] Updating address UI');
    
    els.addrDisplayName.textContent = address.displayName;
    els.addrNeighborhood.textContent = address.neighborhood;
    els.addrSuburb.textContent = address.suburb;
    els.addrCity.textContent = address.city;
    els.addrDistrict.textContent = address.district;
    els.addrState.textContent = address.state;
    els.addrPostcode.textContent = address.postcode;
    els.addrCountry.textContent = address.country;
    els.addressSection.classList.add('active');

    // Truncate long display names
    if (address.displayName && address.displayName.length > 80) {
      els.addrDisplayName.textContent = address.displayName.substring(0, 77) + '...';
      els.addrDisplayName.title = address.displayName;
    }
  }

  /* ─── Toggle Tracking ───────────────────────────────── */

  els.trackingToggle.addEventListener('change', async () => {
    const enabled = els.trackingToggle.checked;
    try {
      await chrome.runtime.sendMessage({
        type: 'toggleTracking',
        enabled
      });
      els.statusText.textContent = enabled ? 'Searching for location...' : 'Tracking paused';
      els.statusText.classList.remove('found');
      if (!enabled) {
        els.statusText.classList.add('paused');
      } else {
        els.statusText.classList.remove('paused');
      }
    } catch (e) {
      console.error('[CoordX Pro] Toggle failed:', e.message);
    }
  });

  /* ─── Reset (New Round) ─────────────────────────────── */

  els.resetBtn.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'resetSearch' });
    } catch (e) {
      console.error('[CoordX Pro] Reset failed:', e.message);
    }

    // Clear UI
    currentCoords = null;
    els.latValue.textContent = '—';
    els.lngValue.textContent = '—';
    els.coordSection.classList.remove('active');
    els.statusText.textContent = 'Searching for location...';
    els.statusText.classList.remove('found', 'paused');

    // Clear address
    els.addrDisplayName.textContent = '—';
    els.addrNeighborhood.textContent = '—';
    els.addrSuburb.textContent = '—';
    els.addrCity.textContent = '—';
    els.addrDistrict.textContent = '—';
    els.addrState.textContent = '—';
    els.addrPostcode.textContent = '—';
    els.addrCountry.textContent = '—';
    els.addressSection.classList.remove('active');

    // Reset map
    const mapFrame = els.mapFrame;
    if (mapFrame.contentWindow) {
      mapFrame.contentWindow.postMessage({ type: 'resetMap' }, '*');
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
    }).catch(err => {
      console.error('[CoordX Pro] Copy failed:', err.message);
      // Fallback
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
