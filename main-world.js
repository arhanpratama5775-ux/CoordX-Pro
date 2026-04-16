/**
 * CoordX Pro — Main World Script (v1.8.32)
 *
 * GeoGuessr only - XHR/Fetch intercept for Google Maps API
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  function sendCoords(lat, lng, source) {
    window.postMessage({
      type: 'COORDX_COORDS',
      lat: lat,
      lng: lng,
      source: source
    }, '*');
  }

  // Track last coords to avoid duplicates
  let lastCoords = null;

  function searchForCoords(text, source) {
    if (!text) return;
    
    try {
      const match = text.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        
        if (!isNaN(lat) && !isNaN(lng) && 
            lat >= -90 && lat <= 90 && 
            lng >= -180 && lng <= 180) {
          
          const key = lat.toFixed(4) + ',' + lng.toFixed(4);
          if (key !== lastCoords) {
            lastCoords = key;
            sendCoords(lat, lng, source);
          }
        }
      }
    } catch (e) {}
  }

  // ─── INTERCEPT XHR ───────────────────────────────────────

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    const url = this._url || '';
    
    this.addEventListener('load', function() {
      if (url.includes('GetMetadata') || url.includes('SingleImageSearch')) {
        searchForCoords(this.responseText, 'xhr');
      }
    });
    
    return originalSend.apply(this, arguments);
  };

  // ─── INTERCEPT FETCH ─────────────────────────────────────

  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input.url || '');
    
    return originalFetch.apply(this, arguments).then(response => {
      if (url.includes('GetMetadata') || url.includes('SingleImageSearch')) {
        response.clone().text().then(text => {
          searchForCoords(text, 'fetch');
        });
      }
      return response;
    });
  };

})();
