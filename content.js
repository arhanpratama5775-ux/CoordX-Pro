/**
 * CoordX Pro — Content Script (v1.8.4)
 * 
 * Request background to inject main world script
 */

(function () {
  'use strict';

  if (window.__coordxProV184Injected) return;
  window.__coordxProV184Injected = true;

  function logToBackground(msg) {
    try {
      chrome.runtime.sendMessage({ type: 'log', message: msg });
    } catch (e) {}
  }

  console.log('[CoordX Pro] Content v1.8.4 loaded');
  logToBackground('Content v1.8.4 loaded');

  let lastSentLat = null;
  let lastSentLng = null;
  let blockedLat = null;
  let blockedLng = null;
  let blockUntil = 0;

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 &&
      Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source) {
    if (!isValidCoord(lat, lng)) return false;

    const now = Date.now();

    // Check if blocked
    if (now < blockUntil && blockedLat !== null && blockedLng !== null) {
      if (Math.abs(lat - blockedLat) < 0.001 && Math.abs(lng - blockedLng) < 0.001) {
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

    logToBackground('✅ ' + source + ': ' + lat.toFixed(4) + ', ' + lng.toFixed(4));

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

  // Listen for messages from main world script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    const data = event.data;
    if (!data || data.type !== 'COORDX_COORDS') return;

    const { lat, lng, source } = data;
    sendCoords(lat, lng, source);
  });

  // Request background to inject main world script
  function requestMainWorldInjection() {
    chrome.runtime.sendMessage({ type: 'injectMainWorld' });
  }

  // WorldGuessr detection
  function detectWorldGuessr() {
    const url = window.location.href;
    const locMatch = url.match(/[?&]location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (locMatch) {
      return { lat: parseFloat(locMatch[1]), lng: parseFloat(locMatch[2]), source: 'url' };
    }

    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.src && iframe.src.includes('location=')) {
        const match = iframe.src.match(/location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (match) {
          return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), source: 'iframe' };
        }
      }
    }

    return null;
  }

  // Force check listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'forceCheck') {
      lastSentLat = null;
      lastSentLng = null;
      blockedLat = null;
      blockedLng = null;
      blockUntil = 0;
      sendResponse({ success: true });
    }
  });

  // Init
  function init() {
    requestMainWorldInjection();
    
    // WorldGuessr detection
    if (window.location.hostname.includes('worldguessr.com')) {
      const result = detectWorldGuessr();
      if (result) {
        sendCoords(result.lat, result.lng, result.source);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setTimeout(init, 500);
  setTimeout(init, 2000);

  // Next button - block old coords
  document.addEventListener('click', (e) => {
    const text = (e.target?.innerText || '').toUpperCase();
    if (text.includes('NEXT') || text.includes('PLAY')) {
      if (lastSentLat !== null && lastSentLng !== null) {
        blockedLat = lastSentLat;
        blockedLng = lastSentLng;
        blockUntil = Date.now() + 20000;
        logToBackground('Block: ' + blockedLat.toFixed(4) + ' for 20s');
      }
      
      lastSentLat = null;
      lastSentLng = null;
    }
  }, true);

})();
