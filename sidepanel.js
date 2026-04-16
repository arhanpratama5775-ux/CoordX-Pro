/**
 * CoordX Pro — Side Panel Script (v1.8.54)
 *
 * Dark Space Theme - Auto-detect enabled
 * Multiplayer auto-place support
 * Country flag display
 */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const els = {
    statusText: $('statusText'),
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
    logsSection: $('logsSection'),
    logsToggle: $('logsToggle'),
    logsContainer: $('logsContainer'),
    logsContent: $('logsContent'),
    logCount: $('logCount'),
    refreshLogsBtn: $('refreshLogsBtn'),
    clearLogsBtn: $('clearLogsBtn'),
    // Auto Place elements
    autoplaceSection: $('autoplaceSection'),
    accuracySelect: $('accuracySelect'),
    placeGuessBtn: $('placeGuessBtn'),
    autoplaceStatus: $('autoplaceStatus'),
    // Country flag elements
    countryFlag: $('countryFlag'),
    flagName: $('flagName')
  };

  let currentLat = null;
  let currentLng = null;
  let geocodeTimeout = null;
  let logsVisible = false;
  let mapCenter = null;
  let mapZoom = 2;

  // Listen for map state from iframe
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'MAP_STATE_RESPONSE') {
      mapCenter = { lat: event.data.lat, lng: event.data.lng };
      mapZoom = event.data.zoom || 2;
    }
  });

  // Request map state from iframe
  function requestMapState() {
    if (els.mapFrame?.contentWindow) {
      els.mapFrame.contentWindow.postMessage({ type: 'GET_MAP_STATE' }, '*');
    }
  }

  /* ─── Init ───────────────────────────────────────────── */

  async function init() {
    const storage = await chrome.storage.local.get(['lastCoords', 'accuracy']);

    // Restore accuracy setting
    if (storage.accuracy) {
      els.accuracySelect.value = storage.accuracy;
    }

    if (storage.lastCoords) {
      const { lat, lng } = storage.lastCoords;
      if (lat && lng) {
        updateUI(lat, lng, 'init');
      }
    } else {
      els.statusText.textContent = 'Searching...';
    }

    loadLogs();
    setInterval(loadLogs, 2000);

    // Poll for coords every 1 second
    setInterval(checkCoords, 1000);
  }

  init();

  /* ─── Check coords periodically ──────────────────────── */

  async function checkCoords() {
    try {
      const storage = await chrome.storage.local.get(['lastCoords']);
      if (storage.lastCoords) {
        const { lat, lng } = storage.lastCoords;

        // Use epsilon comparison for floats
        const isDifferent = currentLat === null || currentLng === null ||
          Math.abs(lat - currentLat) > 0.0001 ||
          Math.abs(lng - currentLng) > 0.0001;

        if (isDifferent) {
          updateUI(lat, lng, 'poll');
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

      els.logsContent.innerHTML = logs.slice(-20).map(l => {
        const time = l.time.split('T')[1]?.split('.')[0] || '';
        return `<div class="log-entry"><span class="log-time">${time}</span> ${escapeHtml(l.message)}</div>`;
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
    chrome.runtime.sendMessage({ type: 'forceUpdate' });
  });

  els.clearLogsBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'clearLogs' });
    loadLogs();
  });

  /* ─── UI Update ──────────────────────────────────────── */

  function updateUI(lat, lng, source) {
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      return;
    }

    currentLat = lat;
    currentLng = lng;

    // Update coords display
    els.latValue.textContent = lat.toFixed(6);
    els.lngValue.textContent = lng.toFixed(6);
    els.coordSection.classList.add('active');

    // Update status
    els.statusText.textContent = 'Found!';
    els.statusText.classList.add('found');

    // Enable place button
    els.placeGuessBtn.disabled = false;
    els.autoplaceSection.classList.add('active');
    els.autoplaceStatus.textContent = 'Ready to place guess';
    els.autoplaceStatus.classList.add('ready');

    // Send to map iframe - try multiple times
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
    setTimeout(sendToMap, 1000);

    // Fetch geocoding
    reverseGeocode(lat, lng);
  }

  /* ─── Listen for Storage Changes ─────────────────────── */

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.lastCoords?.newValue) {
      const { lat, lng } = changes.lastCoords.newValue;
      if (lat && lng) {
        updateUI(lat, lng, 'storage');
      }
    }
  });

  /* ─── Listen for Auto-Place Events ───────────────────── */

  // Listen for auto-place notifications from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'autoPlaced') {
      const { lat, lng, source, debug } = message;
      
      // Update UI to show auto-place happened
      els.autoplaceStatus.textContent = `Auto-placed! (${source})`;
      els.autoplaceStatus.classList.add('ready');
      els.autoplaceStatus.classList.remove('error');
      els.placeGuessBtn.classList.add('placed');
      els.placeGuessBtn.querySelector('span').textContent = 'Auto-Placed!';

      // Reset after delay
      setTimeout(() => {
        els.placeGuessBtn.classList.remove('placed');
        els.placeGuessBtn.querySelector('span').textContent = 'Place Guess';
        els.placeGuessBtn.disabled = false;
        els.autoplaceStatus.textContent = 'Ready for next round';
      }, 3000);
    }
    return true;
  });

  /* ─── Geocoding ──────────────────────────────────────── */

  // Convert country code to flag emoji
  function countryCodeToFlag(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🌍';
    
    // Convert country code to regional indicator symbols
    // A = 🇦 (U+1F1E6), B = 🇧 (U+1F1E7), etc.
    const baseOffset = 0x1F1E6 - 65; // 'A' is 65 in ASCII
    const char1 = String.fromCodePoint(countryCode.charCodeAt(0) + baseOffset);
    const char2 = String.fromCodePoint(countryCode.charCodeAt(1) + baseOffset);
    
    return char1 + char2;
  }

  // Country code to short name mapping
  const countryCodeNames = {
    'US': 'USA', 'GB': 'UK', 'RU': 'Russia', 'DE': 'Germany',
    'FR': 'France', 'JP': 'Japan', 'CN': 'China', 'KR': 'S.Korea',
    'BR': 'Brazil', 'IN': 'India', 'AU': 'Australia', 'CA': 'Canada',
    'IT': 'Italy', 'ES': 'Spain', 'MX': 'Mexico', 'ID': 'Indonesia',
    'NL': 'Netherlands', 'TR': 'Turkey', 'SA': 'Saudi', 'AR': 'Argentina',
    'TH': 'Thailand', 'PL': 'Poland', 'SE': 'Sweden', 'NO': 'Norway',
    'FI': 'Finland', 'DK': 'Denmark', 'BE': 'Belgium', 'AT': 'Austria',
    'CH': 'Swiss', 'PT': 'Portugal', 'CZ': 'Czech', 'GR': 'Greece',
    'HU': 'Hungary', 'RO': 'Romania', 'UA': 'Ukraine', 'VN': 'Vietnam',
    'MY': 'Malaysia', 'PH': 'Philippines', 'SG': 'Singapore', 'NZ': 'NZ',
    'ZA': 'S.Africa', 'EG': 'Egypt', 'NG': 'Nigeria', 'IL': 'Israel',
    'AE': 'UAE', 'TW': 'Taiwan', 'HK': 'HK', 'CL': 'Chile', 'CO': 'Colombia',
    'PE': 'Peru', 'VE': 'Venezuela', 'IE': 'Ireland', 'SK': 'Slovakia',
    'BG': 'Bulgaria', 'HR': 'Croatia', 'RS': 'Serbia', 'SI': 'Slovenia',
    'EE': 'Estonia', 'LV': 'Latvia', 'LT': 'Lithuania', 'IS': 'Iceland'
  };

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

        // Update country flag
        if (addr.country_code) {
          const flag = countryCodeToFlag(addr.country_code.toUpperCase());
          const shortName = countryCodeNames[addr.country_code.toUpperCase()] || addr.country_code.toUpperCase();
          
          // Update flag display
          const flagEmoji = els.countryFlag.querySelector('.flag-emoji');
          if (flagEmoji) flagEmoji.textContent = flag;
          els.flagName.textContent = shortName;
          els.countryFlag.title = addr.country || shortName;
        }

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

  els.copyCoordsBtn.addEventListener('click', () => {
    if (!currentLat || !currentLng) return;
    const text = `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;
    navigator.clipboard.writeText(text).then(() => {
      els.copyCoordsBtn.classList.add('copied');
      els.copyCoordsBtn.querySelector('span').textContent = 'Copied!';
      setTimeout(() => {
        els.copyCoordsBtn.classList.remove('copied');
        els.copyCoordsBtn.querySelector('span').textContent = 'Copy';
      }, 1500);
    });
  });

  /* ─── Auto Place Guess ───────────────────────────────── */

  // Save accuracy setting and notify main-world
  els.accuracySelect.addEventListener('change', async () => {
    const accuracy = els.accuracySelect.value;
    await chrome.storage.local.set({ accuracy: accuracy });

    // Send to content script -> main-world
    chrome.runtime.sendMessage({
      type: 'updateAccuracy',
      accuracy: accuracy
    });
  });

  // Place guess button
  els.placeGuessBtn.addEventListener('click', async () => {
    if (!currentLat || !currentLng) {
      els.autoplaceStatus.textContent = 'No coordinates available';
      els.autoplaceStatus.classList.add('error');
      return;
    }

    const accuracy = els.accuracySelect.value;

    // Calculate offset based on accuracy
    const offset = getAccuracyOffset(accuracy);
    const guessLat = currentLat + offset.lat;
    const guessLng = currentLng + offset.lng;

    // Update button state
    els.placeGuessBtn.disabled = true;
    els.placeGuessBtn.querySelector('span').textContent = 'Placing...';
    els.autoplaceStatus.textContent = 'Getting map state...';

    try {
      // Request map state from iframe
      requestMapState();
      
      // Wait a bit for response
      await new Promise(r => setTimeout(r, 100));

      // Send message to content script to place guess with map state
      const response = await chrome.runtime.sendMessage({
        type: 'placeGuess',
        lat: guessLat,
        lng: guessLng,
        accuracy: accuracy,
        mapCenter: mapCenter,
        mapZoom: mapZoom
      });

      // Show debug info
      if (response?.debug) {
        els.autoplaceStatus.textContent = response.debug;
      }

      if (response?.success) {
        els.placeGuessBtn.classList.add('placed');
        els.placeGuessBtn.querySelector('span').textContent = 'Placed!';
        els.autoplaceStatus.classList.remove('error');
        els.autoplaceStatus.classList.add('ready');

        // Reset button after delay
        setTimeout(() => {
          els.placeGuessBtn.classList.remove('placed');
          els.placeGuessBtn.querySelector('span').textContent = 'Place Guess';
          els.placeGuessBtn.disabled = false;
        }, 3000);
      } else {
        els.autoplaceStatus.textContent = 'Failed: ' + (response?.error || 'Unknown');
        els.autoplaceStatus.classList.add('error');
        els.placeGuessBtn.querySelector('span').textContent = 'Place Guess';
        els.placeGuessBtn.disabled = false;
      }
    } catch (err) {
      els.autoplaceStatus.textContent = 'Error: ' + err.message;
      els.autoplaceStatus.classList.add('error');
      els.autoplaceStatus.classList.remove('ready');
      els.placeGuessBtn.querySelector('span').textContent = 'Place Guess';
      els.placeGuessBtn.disabled = false;
    }
  });

  // Calculate random offset based on accuracy (min-max range)
  function getAccuracyOffset(accuracy) {
    let minOffsetMeters, maxOffsetMeters;

    switch (accuracy) {
      case 'perfect':
        minOffsetMeters = 0;
        maxOffsetMeters = 0;           // 0m - Perfect score
        break;
      case 'near':
        minOffsetMeters = 400;         // Min 400m
        maxOffsetMeters = 800;         // Max 800m - ~4985-4995 points
        break;
      case 'medium':
        minOffsetMeters = 1500;        // Min 1.5km
        maxOffsetMeters = 3000;        // Max 3km - ~4900-4970 points
        break;
      case 'far':
        minOffsetMeters = 8000;        // Min 8km
        maxOffsetMeters = 15000;       // Max 15km - ~4300-4700 points
        break;
      case 'veryfar':
        minOffsetMeters = 40000;       // Min 40km
        maxOffsetMeters = 70000;       // Max 70km - ~2500-3500 points
        break;
      case 'country':
        minOffsetMeters = 150000;      // Min 150km
        maxOffsetMeters = 300000;      // Max 300km - Same country roughly
        break;
      case 'random':
        minOffsetMeters = 500;
        maxOffsetMeters = 100000;      // 0.5-100km random
        break;
      default:
        minOffsetMeters = 400;
        maxOffsetMeters = 800;
    }

    // Convert to degrees (1 degree ≈ 111km)
    const minOffsetDegrees = minOffsetMeters / 111000;
    const maxOffsetDegrees = maxOffsetMeters / 111000;
    
    // Random angle and distance (between min and max)
    const angle = Math.random() * 2 * Math.PI;
    const distance = minOffsetDegrees + Math.random() * (maxOffsetDegrees - minOffsetDegrees);

    return {
      lat: Math.sin(angle) * distance,
      lng: Math.cos(angle) * distance
    };
  }

})();
