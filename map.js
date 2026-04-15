/**
 * CoordX Pro — Map Script (v1.7.7)
 * 
 * Simple marker only - no coords in popup
 */

(function () {
  'use strict';

  console.log('[CoordX Pro] Map loading...');

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

  function updateMarker(lat, lng) {
    console.log('[CoordX Pro] Map: updateMarker', lat, lng);

    // Remove old marker
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }

    // Create new marker - just a simple dot
    marker = L.circleMarker([lat, lng], {
      radius: 10,
      fillColor: '#ef4444',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(map);

    // Fly to location
    map.flyTo([lat, lng], 15, {
      duration: 0.8
    });

    console.log('[CoordX Pro] Map: marker set');
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
      map.flyTo([20, 0], 2, { duration: 0.5 });
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

  console.log('[CoordX Pro] Map ready');

})();
