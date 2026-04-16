/**
 * CoordX Pro — Main World Script (v1.8.18)
 * 
 * Intercept Google Maps API calls for accurate coordinates
 * Based on PlonkIT approach - more reliable than __NEXT_DATA__
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  console.log('[CoordX Pro] Main world v1.8.18');

  function sendCoords(lat, lng, source) {
    window.postMessage({
      type: 'COORDX_COORDS',
      lat: lat,
      lng: lng,
      source: source
    }, '*');
  }

  function sendLog(msg) {
    window.postMessage({
      type: 'COORDX_LOG',
      message: msg
    }, '*');
  }

  // Intercept XMLHttpRequest to catch Google Maps API calls
  const originalOpen = XMLHttpRequest.prototype.open;
  const self = this;

  XMLHttpRequest.prototype.open = function(method, url) {
    const args = arguments;
    
    // Check if this is a Google Maps metadata request
    if (method.toUpperCase() === 'POST' && 
        (url.includes('google.internal.maps.mapsjs.v1.MapsJsInternalService/GetMetadata') ||
         url.includes('google.internal.maps.mapsjs.v1.MapsJsInternalService/SingleImageSearch'))) {
      
      this.addEventListener('load', function() {
        try {
          // Extract coordinates from response
          const match = this.responseText.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
          if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            
            if (!isNaN(lat) && !isNaN(lng) && 
                lat >= -90 && lat <= 90 && 
                lng >= -180 && lng <= 180) {
              sendLog('📍 XHR intercept: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
              sendCoords(lat, lng, 'xhr-intercept');
            }
          }
        } catch (e) {
          sendLog('XHR parse error: ' + e.message);
        }
      });
    }
    
    return originalOpen.apply(this, args);
  };

  // Also try fetch interception
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : input.url;
    
    // Check if this is a Google Maps request
    if (url && (url.includes('GetMetadata') || url.includes('SingleImageSearch'))) {
      return originalFetch.apply(this, arguments).then(response => {
        const clonedResponse = response.clone();
        clonedResponse.text().then(text => {
          try {
            const match = text.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
            if (match) {
              const lat = parseFloat(match[1]);
              const lng = parseFloat(match[2]);
              
              if (!isNaN(lat) && !isNaN(lng) && 
                  lat >= -90 && lat <= 90 && 
                  lng >= -180 && lng <= 180) {
                sendLog('📍 Fetch intercept: ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
                sendCoords(lat, lng, 'fetch-intercept');
              }
            }
          } catch (e) {}
        });
        return response;
      });
    }
    
    return originalFetch.apply(this, arguments);
  };

  sendLog('Main world v1.8.18 ready - XHR intercept active');

})();
