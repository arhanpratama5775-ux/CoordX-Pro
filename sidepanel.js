/**
 * CoordX Pro — Side Panel Script
 * 
 * Handles:
 * - Receiving coordinate updates from background worker
 * - Reverse geocoding via Nominatim API
 * - Communicating with the map iframe
 * - Toggle and reset functionality
 * - Copy-to-clipboard for coordinates
 * - Restoring last known state on panel reopen (fixes the disappearing bug)
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

  /* ─── Initialize ────────────────────────────────────── */

  /**
   * On panel open, restore last known coordinates from storage.
   * This is THE key fix for the "side panel disappearing" issue —
   * when the panel reopens, it reads the persisted state instead of
   * showing blank data.
   */
  async function init() {
    // Restore tracking toggle state
    const storage = await chrome.storage.local.get(['trackingEnabled', 'lastCoords', 'lastAddress']);

    if (storage.trackingEnabled !== undefined) {
      els.trackingToggle.checked = storage.trackingEnabled;
    }

    // Restore last coordinates if available
    if (storage.lastCoords) {
      currentCoords = storage.lastCoords;
      updateCoordinates(storage.lastCoords.lat, storage.lastCoords.lng);
      els.statusText.textContent = 'Location found!';
      els.statusText.classList.add('found');
    }

    // Restore address if available
    if (storage.lastAddress) {
      updateAddressUI(storage.lastAddress);
    }

    // Request current status from background
    try {
      const status = await chrome.runtime.sendMessage({ type: 'getStatus' });
      if (status.lastCoords && !currentCoords) {
        currentCoords = status.lastCoords;
        updateCoordinates(status.lastCoords.lat, status.lastCoords.lng);
        els.statusText.textContent = 'Location found!';
        els.statusText.classList.add('found');
      }
      if (status.searching && !currentCoords) {
        els.statusText.textContent = 'Searching for location...';
        els.statusText.classList.remove('found');
      }
    } catch (e) {
      // Background worker might not be ready yet
      console.warn('[CoordX Pro] Could not get status:', e.message);
    }
  }

  init();

  /* ─── Message Listener ──────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'coordFound') {
      currentCoords = { lat: message.lat, lng: message.lng };
      updateCoordinates(message.lat, message.lng);
      els.statusText.textContent = 'Location found!';
      els.statusText.classList.add('found');

      // Send to map iframe
      postToMap(message.lat, message.lng);

      // Reverse geocode
      reverseGeocode(message.lat, message.lng);
    }
  });

  /**
   * Also listen for storage changes — this ensures we catch updates
   * even if the message was sent while the panel was closed.
   */
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.lastCoords && changes.lastCoords.newValue) {
      const { lat, lng } = changes.lastCoords.newValue;
      if (!currentCoords || currentCoords.lat !== lat || currentCoords.lng !== lng) {
        currentCoords = { lat, lng };
        updateCoordinates(lat, lng);
        postToMap(lat, lng);
        reverseGeocode(lat, lng);
        els.statusText.textContent = 'Location found!';
        els.statusText.classList.add('found');
      }
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
    if (mapFrame && mapFrame.contentWindow) {
      mapFrame.contentWindow.postMessage({
        type: 'updateCoords',
        lat,
        lng
      }, '*');
    } else {
      // Retry after iframe loads
      mapFrame.addEventListener('load', () => {
        mapFrame.contentWindow.postMessage({
          type: 'updateCoords',
          lat,
          lng
        }, '*');
      }, { once: true });
    }
  }

  /* ─── Reverse Geocoding ─────────────────────────────── */

  async function reverseGeocode(lat, lng) {
    // Debounce rapid calls
    if (geocodeTimeout) clearTimeout(geocodeTimeout);

    geocodeTimeout = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const response = await fetch(url, {
          headers: { 'Accept-Language': 'en' }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const address = parseAddress(data);
        updateAddressUI(address);

        // Persist address for panel reopen
        await chrome.storage.local.set({ lastAddress: address });

      } catch (err) {
        console.error('[CoordX Pro] Reverse geocoding failed:', err.message);
        // Retry once after 2 seconds
        setTimeout(() => reverseGeocode(lat, lng), 2000);
      }
    }, 300);
  }

  function parseAddress(data) {
    const addr = data.address || {};
    return {
      displayName: data.display_name || '—',
      neighborhood: addr.neighbourhood || addr.hamlet || '—',
      suburb: addr.suburb || addr.village || addr.town || '—',
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

    // Truncate long display names
    if (address.displayName.length > 80) {
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
      els.statusText.classList.toggle('found', false);
      els.statusText.classList.toggle('paused', !enabled);
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
    const addressFields = [
      els.addrDisplayName, els.addrNeighborhood, els.addrSuburb,
      els.addrCity, els.addrDistrict, els.addrState,
      els.addrPostcode, els.addrCountry
    ];
    addressFields.forEach(el => el.textContent = '—');
    els.addressSection.classList.remove('active');

    // Reset map
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
    }).catch(err => {
      console.error('[CoordX Pro] Copy failed:', err.message);
    });
  });

})();
