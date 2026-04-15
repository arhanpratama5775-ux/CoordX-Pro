/**
 * CoordX Pro — Map Script (v1.1.5)
 * 
 * Uses Leaflet with OpenStreetMap tiles.
 * Simple circle marker - no image dependencies.
 */

(function () {
  'use strict';

  console.log('[CoordX Pro] Map script v1.1.5 loading...');

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
  let lastLat = null;
  let lastLng = null;

  function updateMarker(lat, lng) {
    console.log('[CoordX Pro] Map: updateMarker called with', lat, lng);

    // Always remove old marker first
    if (marker) {
      console.log('[CoordX Pro] Map: removing old marker');
      map.removeLayer(marker);
      marker = null;
    }

    // Create new marker
    marker = L.circleMarker([lat, lng], {
      radius: 12,
      fillColor: '#6366f1',
      color: '#fff',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(map);

    // Bind popup with coordinates
    marker.bindPopup(`<div style="
      font-family: -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 600;
      color: #e2e8f0;
      background: rgba(15, 23, 42, 0.95);
      padding: 6px 12px;
      border-radius: 8px;
    ">📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}</div>`, {
      closeButton: false,
      className: 'coord-popup'
    }).openPopup();

    // Fly to location
    map.flyTo([lat, lng], 15, {
      duration: 0.8,
      easeLinearity: 0.5
    });

    lastLat = lat;
    lastLng = lng;

    console.log('[CoordX Pro] Map: marker updated successfully');
  }

  // Listen for messages from sidepanel
  window.addEventListener('message', (event) => {
    const data = event.data;
    
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.type === 'updateCoords') {
      console.log('[CoordX Pro] Map: received updateCoords message', data);
      
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('[CoordX Pro] Map: invalid coords');
        return;
      }
      
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.warn('[CoordX Pro] Map: coords out of range');
        return;
      }

      updateMarker(lat, lng);
    }

    if (data.type === 'resetMap') {
      console.log('[CoordX Pro] Map: resetting');
      if (marker) {
        map.removeLayer(marker);
        marker = null;
      }
      map.flyTo([20, 0], 2, { duration: 0.5 });
      lastLat = null;
      lastLng = null;
    }
  });

  // Fix map size after iframe loads
  function fixMapSize() {
    map.invalidateSize();
    console.log('[CoordX Pro] Map: size invalidated');
  }

  setTimeout(fixMapSize, 100);
  setTimeout(fixMapSize, 500);
  setTimeout(fixMapSize, 1000);
  setTimeout(fixMapSize, 2000);

  // Fix on visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(fixMapSize, 100);
    }
  });

  console.log('[CoordX Pro] Map script ready');

})();
