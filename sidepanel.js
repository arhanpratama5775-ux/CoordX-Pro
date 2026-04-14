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
 * 
 * Bug fixes in v1.0.1:
 * - Map now updates on side panel reopen (was missing postToMap call in init)
 * - Reverse geocoding has retry limit (was infinite loop)
 * - Duplicate coordinate updates prevented (onMessage + onChanged both firing)
 * - Map iframe load race condition handled properly
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
  let geocodeRetryCount = 0;
  const MAX_GEOCODE_RETRIES = 2;

  // Flag to prevent duplicate processing from onMessage + onChanged
  let processingCoords = false;

  /* ─── Initialize ────────────────────────────────────── */

  /**
   * On panel open, restore last known coordinates from storage.
   * This is THE key fix for the "side panel disappearing" issue —
   * when the panel reopens, it reads the persisted state instead of
   * showing blank data.
   * 
   * v1.0.1 FIX: Also sends coordinates to map iframe on restore.
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

      // BUG FIX: Also update the map iframe on restore!
      postToMap(storage.lastCoords.lat, storage.lastCoords.lng);
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
        postToMap(status.lastCoords.lat, status.lastCoords.lng);
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

  /* ─── Coordinate Update Handler (deduplicated) ──────── */

  /**
   * Single entry point for handling new coordinates.
   * Prevents duplicate processing from onMessage + onChanged.
   */
  function handleNewCoords(lat, lng, source) {
    // Skip if we already have these exact coordinates
    if (currentCoords && 
        currentCoords.lat === lat && 
        currentCoords.lng === lng) {
      console.log(`[CoordX Pro] Duplicate coord update from ${source}, skipping`);
      return;
    }

    console.log(`[CoordX Pro] New coords from ${source}:`, lat, lng);
    currentCoords = { lat, lng };
    geocodeRetryCount = 0; // Reset geocode retry counter on new coords

    updateCoordinates(lat, lng);
    postToMap(lat, lng);
    reverseGeocode(lat, lng);
    
    els.statusText.textContent = 'Location found!';
    els.statusText.classList.add('found');
    els.statusText.classList.remove('paused');
  }

  /* ─── Message Listener ──────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'coordFound') {
      handleNewCoords(message.lat, message.lng, 'onMessage');
    }
  });

  /**
   * Also listen for storage changes — this ensures we catch updates
   * even if the message was sent while the panel was closed.
   * 
   * BUG FIX: Use handleNewCoords() which deduplicates against currentCoords,
   * so we don't double-process if onMessage already handled it.
   */
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.lastCoords && changes.lastCoords.newValue) {
      const { lat, lng } = changes.lastCoords.newValue;
      handleNewCoords(lat, lng, 'onChanged');
    }
  });

  /* ─── Coordinate Display ────────────────────────────── */

  function updateCoordinates(lat, lng) {
    els.latValue.textContent = lat.toFixed(6);
    els.lngValue.textContent = lng.toFixed(6);
    els.coordSection.classList.add('active');
  }

  /* ─── Map Communication ─────────────────────────────── */

  /**
   * Send coordinates to the map iframe.
   * BUG FIX: Handles race condition where iframe isn't loaded yet.
   * Uses a proper load listener instead of just checking contentWindow.
   */
  function postToMap(lat, lng) {
    const mapFrame = els.mapFrame;
    
    const sendMsg = () => {
      if (mapFrame.contentWindow) {
        mapFrame.contentWindow.postMessage({
          type: 'updateCoords',
          lat,
          lng
        }, '*');
      }
    };

    // If iframe is already loaded, send immediately
    if (mapFrame.contentDocument && mapFrame.contentDocument.readyState === 'complete') {
      sendMsg();
    } else {
      // Wait for iframe to load
      mapFrame.addEventListener('load', sendMsg, { once: true });
    }
  }

  /* ─── Reverse Geocoding ─────────────────────────────── */

  /**
   * Reverse geocode coordinates via Nominatim API.
   * BUG FIX: Has max retry limit to prevent infinite loop.
   * Retries up to MAX_GEOCODE_RETRIES times on failure.
   */
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
        
        if (data.error) {
          throw new Error(data.error);
        }

        const address = parseAddress(data);
        updateAddressUI(address);

        // Persist address for panel reopen
        await chrome.storage.local.set({ lastAddress: address });

        // Reset retry counter on success
        geocodeRetryCount = 0;

      } catch (err) {
        console.error('[CoordX Pro] Reverse geocoding failed:', err.message);
        
        // BUG FIX: Only retry up to MAX_GEOCODE_RETRIES times
        if (geocodeRetryCount < MAX_GEOCODE_RETRIES) {
          geocodeRetryCount++;
          console.log(`[CoordX Pro] Geocode retry ${geocodeRetryCount}/${MAX_GEOCODE_RETRIES}`);
          setTimeout(() => reverseGeocode(lat, lng), 2000 * geocodeRetryCount);
        } else {
          console.warn('[CoordX Pro] Max geocode retries reached, giving up');
          // Show error in UI
          els.addrDisplayName.textContent = 'Address not available';
          els.addressSection.classList.add('active');
        }
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
    geocodeRetryCount = 0;
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
      // Fallback: use execCommand
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
