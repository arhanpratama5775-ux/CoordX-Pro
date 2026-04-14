/**
 * CoordX Pro — Map Script (loaded in iframe)
 * 
 * Uses Leaflet with OpenStreetMap tiles.
 * Receives coordinate updates via postMessage from sidepanel.js.
 */

(function () {
  'use strict';

  /* ─── Map Initialization ────────────────────────────── */

  const map = L.map('map', {
    center: [20, 0],
    zoom: 2,
    zoomControl: true,
    attributionControl: true
  });

  // BUG FIX: Set Leaflet icon path to local bundled images
  L.Icon.Default.imagePath = 'leaflet/images';

  // Dark-themed tile layer for consistent UI
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Custom marker icon
  const markerIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 24px; height: 24px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: 3px solid #fff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.5);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
  });

  let marker = null;
  let coordDisplay = null;

  /* ─── Coordinate Display Overlay ────────────────────── */

  function addCoordDisplay(lat, lng) {
    if (coordDisplay) {
      coordDisplay.setLatLng([lat, lng]);
      coordDisplay.setContent(formatCoordText(lat, lng));
      return;
    }

    coordDisplay = L.popup({
      closeButton: false,
      className: 'coord-popup',
      offset: [0, -28]
    })
    .setLatLng([lat, lng])
    .setContent(formatCoordText(lat, lng))
    .openOn(map);
  }

  function formatCoordText(lat, lng) {
    return `<div style="
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 600;
      color: #e2e8f0;
      text-align: center;
      background: rgba(15, 23, 42, 0.9);
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid rgba(99, 102, 241, 0.3);
    ">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>`;
  }

  /* ─── Message Handler ───────────────────────────────── */

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'updateCoords') {
      // Validate coordinate data
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      if (isNaN(lat) || isNaN(lng)) return;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

      // Update or create marker
      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
      }

      // Fly to location with animation
      map.flyTo([lat, lng], 16, {
        duration: 1.2,
        easeLinearity: 0.25
      });

      // Show coordinate display
      addCoordDisplay(lat, lng);
    }

    if (data.type === 'resetMap') {
      if (marker) {
        map.removeLayer(marker);
        marker = null;
      }
      if (coordDisplay) {
        map.closePopup();
        coordDisplay = null;
      }
      map.flyTo([20, 0], 2, { duration: 0.8 });
    }
  });

  /* ─── Fix map rendering after iframe resize ─────────── */

  // Leaflet sometimes doesn't render correctly in iframes
  // Force invalidateSize after a short delay
  setTimeout(() => {
    map.invalidateSize();
  }, 200);

  // Also handle visibility changes
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(() => map.invalidateSize(), 100);
    }
  });

})();
