/**
 * CoordX Pro — Content Script (v1.8.29)
 * 
 * GeoGuessr only - handle coords from main world
 */

(function () {
  'use strict';

  if (window.__coordxProInjected) return;
  window.__coordxProInjected = true;

  // Coords tracking
  let lastSentLat = null;
  let lastSentLng = null;
  
  // Blocking after NEXT
  let blockedLat = null;
  let blockedLng = null;
  let blockedCount = 0;

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 &&
      Math.abs(lng) > 0.001;
  }

  function resetAll() {
    lastSentLat = null;
    lastSentLng = null;
    blockedLat = null;
    blockedLng = null;
    blockedCount = 0;
  }

  function sendCoords(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return false;

    // Block old coords after NEXT
    if (blockedLat !== null && blockedLng !== null) {
      if (Math.abs(lat - blockedLat) < 0.0001 && Math.abs(lng - blockedLng) < 0.0001) {
        blockedCount++;
        return false;
      }
    }

    // Skip if same as last sent
    if (lastSentLat !== null && lastSentLng !== null) {
      if (Math.abs(lastSentLat - lat) < 0.0001 && Math.abs(lastSentLng - lng) < 0.0001) {
        return false;
      }
    }

    lastSentLat = lat;
    lastSentLng = lng;

    try {
      chrome.runtime.sendMessage({
        type: 'contentCoords',
        lat: lat,
        lng: lng,
        source: source
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Listen for messages from main world
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    const data = event.data;
    if (!data) return;

    if (data.type === 'COORDX_COORDS') {
      const { lat, lng, source } = data;
      sendCoords(lat, lng, source);
    }
  });

  // Request injection
  function requestMainWorldInjection() {
    chrome.runtime.sendMessage({ type: 'injectMainWorld' });
  }

  // Force check listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'forceCheck') {
      resetAll();
      requestMainWorldInjection();
      sendResponse({ success: true });
    }
  });

  // Init
  function init() {
    requestMainWorldInjection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setTimeout(init, 500);
  setTimeout(init, 2000);

  // Handle NEXT - block old coords
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT') || text.includes('PLAY')) {
      if (lastSentLat !== null && lastSentLng !== null) {
        blockedLat = lastSentLat;
        blockedLng = lastSentLng;
      }
      lastSentLat = null;
      lastSentLng = null;
    }
  }, true);

})();
