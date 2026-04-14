/**
 * CoordX Pro — Side Panel Script (v1.1.2)
 * 
 * FIX: Always clear old address and fetch new geocoding for new coordinates
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
    resetBtn: $('resetBtn')
  };

  let currentCoords = null;
  let geocodeTimeout = null;

  console.log('[CoordX Pro] Side panel v1.1.2 loaded');

  /* ─── Initialize ────────────────────────────────────── */

  async function init() {
    console.log('[CoordX Pro] Initializing...');
    
    const storage = await chrome.storage.local.get(['trackingEnabled']);

    if (storage.trackingEnabled !== undefined) {
      els.trackingToggle.checked = storage.trackingEnabled;
    }

    // DON'T restore old coords/address - always start fresh
    els.statusText.textContent = 'Searching for location...';
  }

  init();

  /* ─── Coordinate Update Handler ─────────────────────── */

  function handleNewCoords(lat, lng, source) {
    // ALWAYS update - no duplicate check
    console.log(`[CoordX Pro] ✅ NEW coords from ${source}:`, lat, lng);
    currentCoords = { lat, lng };

    // Clear old address from storage
    chrome.storage.local.remove(['lastAddress', 'lastCoords']);

    // Update UI immediately
    updateCoordinates(lat, lng);
    postToMap(lat, lng);
    
    els.statusText.textContent = 'Location found!';
    els.statusText.classList.add('found');
    els.statusText.classList.remove('paused');
    
    // ALWAYS fetch new geocoding
    reverseGeocode(lat, lng);
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
    const mapFrame = els.mapFrame;
    
    if (mapFrame.contentWindow) {
      mapFrame.contentWindow.postMessage({
        type: 'updateCoords',
        lat,
        lng
      }, '*');
    }
  }

  /* ─── Reverse Geocoding ─────────────────────────────── */

  async function reverseGeocode(lat, lng) {
    console.log('[CoordX Pro] 🌍 Geocoding:', lat, lng);
    
    // Clear old address IMMEDIATELY and show loading
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

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('[CoordX Pro] Geocode result:', data);
        
        if (data.error) {
          throw new Error(data.error);
        }

        const address = parseAddress(data);
        updateAddressUI(address);

        // Save new address
        chrome.storage.local.set({ lastAddress: address, lastCoords: { lat, lng } });

      } catch (err) {
        console.error('[CoordX Pro] Geocoding failed:', err.message);
        
        // Show coordinates as fallback
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
