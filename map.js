/**
 * CoordX Pro — Map Script (v1.8.29)
 * 
 * Donut style marker
 */

(function () {
  'use strict';

  // Initialize map
  const map = L.map('map', {
    center: [20, 0],
    zoom: 2,
    zoomControl: true
  });

  // Dark tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  let marker = null;
  let markerOuter = null;

  function updateMarker(lat, lng) {
    // Remove old markers
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }
    if (markerOuter) {
      map.removeLayer(markerOuter);
      markerOuter = null;
    }

    // Create donut marker - outer ring
    markerOuter = L.circleMarker([lat, lng], {
      radius: 16,
      fillColor: 'transparent',
      color: '#ef4444',
      weight: 4,
      opacity: 1,
      fillOpacity: 0
    }).addTo(map);

    // Inner small dot (center of donut)
    marker = L.circleMarker([lat, lng], {
      radius: 4,
      fillColor: '#ef4444',
      color: '#ef4444',
      weight: 0,
      opacity: 1,
      fillOpacity: 1
    }).addTo(map);

    // Fly to location
    map.flyTo([lat, lng], 15, {
      duration: 0.8
    });
  }

  // Listen for messages from sidepanel
  window.addEventListener('message', (event) => {
    const data = event.data;
    
    if (!data || typeof data !== 'object') return;

    if (data.type === 'updateCoords') {
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        updateMarker(lat, lng);
      }
    }

    if (data.type === 'resetMap') {
      if (marker) {
        map.removeLayer(marker);
        marker = null;
      }
      if (markerOuter) {
        map.removeLayer(markerOuter);
        markerOuter = null;
      }
      map.flyTo([20, 0], 2, { duration: 0.5 });
    }

    // Respond to map state request
    if (data.type === 'GET_MAP_STATE') {
      const center = map.getCenter();
      window.parent.postMessage({
        type: 'MAP_STATE_RESPONSE',
        lat: center.lat,
        lng: center.lng,
        zoom: map.getZoom()
      }, '*');
    }
  });

  // Fix map size after load
  function fixMapSize() {
    map.invalidateSize();
  }

  setTimeout(fixMapSize, 100);
  setTimeout(fixMapSize, 500);
  setTimeout(fixMapSize, 1000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(fixMapSize, 100);
    }
  });

})();
