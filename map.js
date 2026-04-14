/**
 * CoordX Pro — Map Script (v1.1.3)
 * 
 * Uses Leaflet with OpenStreetMap tiles.
 * Simple circle marker - no image dependencies.
 */

(function () {
  'use strict';

  console.log('[CoordX Pro] Map script loaded');

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

  // Simple circle marker (no image needed)
  let marker = null;
  let coordDisplay = null;

  function updateMarker(lat, lng) {
    console.log('[CoordX Pro] Map updating marker:', lat, lng);

    // Remove old marker
    if (marker) {
      map.removeLayer(marker);
    }

    // Create new marker with circle
    marker = L.circleMarker([lat, lng], {
      radius: 12,
      fillColor: '#6366f1',
      color: '#fff',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(map);

    // Add pulsing effect with CSS
    marker.on('add', function() {
      const el = this.getElement();
      if (el) {
        el.style.animation = 'pulse 2s infinite';
      }
    });

    // Fly to location
    map.flyTo([lat, lng], 15, {
      duration: 1,
      easeLinearity: 0.5
    });

    // Add coordinate popup
    if (coordDisplay) {
      map.closePopup(coordDisplay);
    }
    
    coordDisplay = L.popup({
      closeButton: false,
      className: 'coord-popup',
      offset: [0, -20]
    })
    .setLatLng([lat, lng])
    .setContent(`<div style="
      font-family: -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 600;
      color: #e2e8f0;
      background: rgba(15, 23, 42, 0.95);
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid rgba(99, 102, 241, 0.4);
      white-space: nowrap;
    ">📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}</div>`)
    .openOn(map);

    console.log('[CoordX Pro] Marker updated successfully');
  }

  // Listen for messages from sidepanel
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'updateCoords') {
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('[CoordX Pro] Invalid coords received');
        return;
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.warn('[CoordX Pro] Coords out of range');
        return;
      }

      updateMarker(lat, lng);
    }

    if (data.type === 'resetMap') {
      console.log('[CoordX Pro] Resetting map');
      if (marker) {
        map.removeLayer(marker);
        marker = null;
      }
      if (coordDisplay) {
        map.closePopup();
        coordDisplay = null;
      }
      map.flyTo([20, 0], 2, { duration: 0.5 });
    }
  });

  // Fix map size after iframe loads
  setTimeout(() => map.invalidateSize(), 100);
  setTimeout(() => map.invalidateSize(), 500);
  setTimeout(() => map.invalidateSize(), 1000);

  // Fix on visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(() => map.invalidateSize(), 100);
    }
  });

  console.log('[CoordX Pro] Map ready');

})();
