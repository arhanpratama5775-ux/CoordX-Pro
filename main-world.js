/**
 * CoordX Pro — Main World Script (v1.8.48)
 *
 * GeoGuessr only - XHR/Fetch intercept for coordinates
 * Place Guess using React Fiber (Location Resolver method)
 */

(function() {
  if (window.__coordxMainInjected) return;
  window.__coordxMainInjected = true;

  // ─── GLOBAL COORDINATES STORAGE ───────────────────────────
  window.__coordxGlobalCoords = { lat: 0, lng: 0 };
  window.__coordxMaps = [];

  // Track Google Maps instances via defineProperty
  const originalDefineProperty = Object.defineProperty;
  Object.defineProperty = function(target, prop, descriptor) {
    try {
      if (prop === 'map' && descriptor.value && typeof descriptor.value.getCenter === 'function') {
        window.__coordxMaps.push(descriptor.value);
      }
    } catch (e) {}
    return originalDefineProperty.apply(this, arguments);
  };

  function sendCoords(lat, lng, source) {
    window.postMessage({
      type: 'COORDX_COORDS',
      lat: lat,
      lng: lng,
      source: source
    }, '*');
  }

  let lastCoords = null;

  function searchForCoords(text, source) {
    if (!text) return;
    
    try {
      // Pattern 1: [null,null,lat,lng]
      const match1 = text.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
      if (match1) {
        const lat = parseFloat(match1[1]);
        const lng = parseFloat(match1[2]);
        
        if (!isNaN(lat) && !isNaN(lng) && 
            lat >= -90 && lat <= 90 && 
            lng >= -180 && lng <= 180) {
          
          const key = lat.toFixed(4) + ',' + lng.toFixed(4);
          if (key !== lastCoords) {
            lastCoords = key;
            window.__coordxGlobalCoords = { lat, lng };
            sendCoords(lat, lng, source);
          }
        }
      }

      // Pattern 2: lat,lng format (from Location Resolver)
      const match2 = text.match(/(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match2) {
        const lat = parseFloat(match2[1]);
        const lng = parseFloat(match2[2]);
        
        if (!isNaN(lat) && !isNaN(lng) && 
            lat >= -90 && lat <= 90 && 
            lng >= -180 && lng <= 180) {
          
          const key = lat.toFixed(4) + ',' + lng.toFixed(4);
          if (key !== lastCoords) {
            lastCoords = key;
            window.__coordxGlobalCoords = { lat, lng };
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
    this._method = method;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    const url = this._url || '';
    const method = this._method || 'GET';
    
    this.addEventListener('load', function() {
      // Intercept Google Maps API calls (Location Resolver method)
      if (method.toUpperCase() === 'POST' && 
          (url.includes('GetMetadata') || url.includes('SingleImageSearch'))) {
        searchForCoords(this.responseText, 'xhr-api');
      }
      
      // Also check other patterns
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
    const method = init?.method || 'GET';

    return originalFetch.apply(this, arguments).then(response => {
      if (url.includes('GetMetadata') || url.includes('SingleImageSearch')) {
        response.clone().text().then(text => {
          searchForCoords(text, method === 'POST' ? 'fetch-api' : 'fetch');
        });
      }
      return response;
    });
  };

})();

// ─── AUTO PLACE GUESS HANDLER ─────────────────────────────

(function() {
  'use strict';

  // Listen for place guess request
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    
    if (!data || data.type !== 'COORDX_PLACE_GUESS') return;

    const { lat, lng, accuracy } = data;
    
    const result = placeGuess(lat, lng, accuracy || 0);
    
    window.postMessage({
      type: 'COORDX_PLACE_RESULT',
      ...result
    }, '*');
  });

  // ─── PLACE GUESS - LOCATION RESOLVER METHOD ───────────────
  
  function placeGuess(targetLat, targetLng, accuracy) {
    const debug = [];
    
    try {
      debug.push('Target:' + targetLat.toFixed(4) + ',' + targetLng.toFixed(4));

      // Apply accuracy offset
      let lat = targetLat;
      let lng = targetLng;
      
      if (accuracy > 0) {
        const degreesOffset = accuracy / 111;
        const randomAngle = Math.random() * 2 * Math.PI;
        const randomDistance = Math.random() * degreesOffset;
        lat += Math.cos(randomAngle) * randomDistance;
        lng += Math.sin(randomAngle) * randomDistance;
        debug.push('Acc:' + accuracy + 'km');
      }

      // Step 1: Try Location Resolver method (direct React handler call)
      const result = placeMarkerReact(lat, lng, debug);
      if (result.success) {
        return result;
      }

      // Step 2: Try opening collapsed map first
      const opened = openGuessMap();
      if (opened) {
        debug.push('Opened');
        // Wait for map to open then retry
        return new Promise(resolve => {
          setTimeout(() => {
            const retryResult = placeMarkerReact(lat, lng, debug);
            if (retryResult.success) {
              resolve(retryResult);
            } else {
              // Fallback to click simulation
              const fallbackResult = placeMarkerClick(lat, lng, debug);
              resolve(fallbackResult);
            }
          }, 500);
        });
      }

      // Step 3: Fallback to click simulation
      return placeMarkerClick(lat, lng, debug);

    } catch (e) {
      return { success: false, error: e.message, debug: debug.join('|') };
    }
  }

  // ─── REACT FIBER METHOD (Location Resolver) ───────────────
  
  function placeMarkerReact(lat, lng, debug) {
    try {
      // Method 1: Standard guess map canvas
      let element = document.querySelector('[class^="guess-map_canvas__"]');
      
      // Method 2: Try other selectors
      if (!element) {
        element = document.querySelector('[class*="guess-map_canvas"]');
      }
      if (!element) {
        element = document.querySelector('[class*="guessMap"]');
      }
      
      if (!element) {
        debug.push('NoMapElement');
        return { success: false, error: 'No map element found', debug: debug.join('|') };
      }

      debug.push('MapEl:found');

      // Get React Fiber
      const reactKeys = Object.keys(element);
      const reactKey = reactKeys.find(key => key.startsWith('__reactFiber$'));
      
      if (!reactKey) {
        debug.push('NoReactKey');
        return { success: false, error: 'No React fiber found', debug: debug.join('|') };
      }

      const elementProps = element[reactKey];
      debug.push('Fiber:found');

      // Navigate to find the map click handler
      // Path: elementProps.return.return.memoizedProps.map.__e3_.click
      try {
        const mapProps = elementProps?.return?.return?.memoizedProps?.map;
        
        if (!mapProps) {
          debug.push('NoMapProps');
          return { success: false, error: 'No map props', debug: debug.join('|') };
        }

        debug.push('MapProps:found');

        const clickHandlers = mapProps.__e3_?.click;
        
        if (!clickHandlers) {
          debug.push('NoClickHandlers');
          return { success: false, error: 'No click handlers', debug: debug.join('|') };
        }

        debug.push('ClickH:found');

        // Create fake latLng object (Location Resolver style)
        const latLngFns = {
          latLng: {
            lat: () => lat,
            lng: () => lng,
          }
        };

        // Get all click handler keys
        const handlerKeys = Object.keys(clickHandlers);
        const lastKey = handlerKeys[handlerKeys.length - 1];
        const clickHandler = clickHandlers[lastKey];

        if (!clickHandler) {
          debug.push('NoHandler');
          return { success: false, error: 'No click handler', debug: debug.join('|') };
        }

        debug.push('Handler:found');

        // Call all functions in the click handler
        const handlerFuncKeys = Object.keys(clickHandler);
        let called = 0;

        for (let i = 0; i < handlerFuncKeys.length; i++) {
          const fn = clickHandler[handlerFuncKeys[i]];
          if (typeof fn === 'function') {
            try {
              fn(latLngFns);
              called++;
            } catch (e) {
              debug.push('FnErr:' + e.message.substring(0, 20));
            }
          }
        }

        debug.push('Called:' + called);

        if (called > 0) {
          return { success: true, debug: debug.join('|') };
        }

        return { success: false, error: 'No functions called', debug: debug.join('|') };

      } catch (pathError) {
        debug.push('PathErr:' + pathError.message.substring(0, 30));
        return { success: false, error: pathError.message, debug: debug.join('|') };
      }

    } catch (e) {
      debug.push('ReactErr:' + e.message.substring(0, 30));
      return { success: false, error: e.message, debug: debug.join('|') };
    }
  }

  // ─── STREAKS MAP METHOD ───────────────────────────────────
  
  function placeMarkerStreaks(lat, lng, debug) {
    try {
      let element = document.querySelector('[class*="region-map_mapCanvas"]');
      
      if (!element) {
        debug.push('NoStreaksMap');
        return { success: false, debug: debug.join('|') };
      }

      debug.push('StreaksMap:found');

      const reactKeys = Object.keys(element);
      const reactKey = reactKeys.find(key => key.startsWith('__reactFiber$'));
      
      if (!reactKey) {
        return { success: false, debug: debug.join('|') + '|NoFiber' };
      }

      const elementProps = element[reactKey];
      const mapElementClick = elementProps?.return?.return?.memoizedProps?.map?.__e3_?.click;

      if (!mapElementClick) {
        return { success: false, debug: debug.join('|') + '|NoClick' };
      }

      const latLngFn = {
        latLng: {
          lat: () => lat,
          lng: () => lng,
        }
      };

      const clickKeys = Object.keys(mapElementClick);
      const funcString = "(e.latLng.lat(),e.latLng.lng())}";
      let called = 0;

      for (let i = 0; i < clickKeys.length; i++) {
        const curr = Object.keys(mapElementClick[clickKeys[i]]);
        let func = curr.find(l => typeof mapElementClick[clickKeys[i]][l] === 'function');
        let prop = mapElementClick[clickKeys[i]][func];
        
        if (prop && prop.toString().slice(5) === funcString) {
          prop(latLngFn);
          called++;
        }
      }

      debug.push('StreaksCalled:' + called);
      return { success: called > 0, debug: debug.join('|') };

    } catch (e) {
      return { success: false, debug: debug.join('|') + '|StreaksErr:' + e.message.substring(0, 20) };
    }
  }

  // ─── CLICK SIMULATION FALLBACK ────────────────────────────
  
  function placeMarkerClick(lat, lng, debug) {
    debug.push('Fallback:click');

    const canvas = findGuessMapCanvas();
    if (!canvas) {
      return { success: false, error: 'No canvas found', debug: debug.join('|') };
    }

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    debug.push('Click:' + Math.round(centerX) + ',' + Math.round(centerY));
    simulateClick(canvas, centerX, centerY);

    return { success: true, debug: debug.join('|'), warning: 'Click fallback - may need manual pan' };
  }

  // ─── HELPER FUNCTIONS ─────────────────────────────────────

  function findGuessMapCanvas() {
    const allCanvases = Array.from(document.querySelectorAll('canvas'))
      .filter(c => {
        if (c.offsetParent === null) return false;
        const rect = c.getBoundingClientRect();
        if (rect.left < 0 || rect.top < 0) return false;
        if (rect.width < 50 || rect.height < 50) return false;
        return true;
      })
      .map(c => {
        const rect = c.getBoundingClientRect();
        return { el: c, rect, area: rect.width * rect.height };
      });

    if (allCanvases.length === 0) return null;

    const guessMapCandidates = allCanvases.filter(c => {
      const w = c.rect.width;
      const h = c.rect.height;
      return w >= 200 && w <= 800 && h >= 150 && h <= 600;
    });

    if (guessMapCandidates.length === 0) {
      allCanvases.sort((a, b) => b.area - a.area);
      return allCanvases.length > 1 ? allCanvases[1].el : allCanvases[0].el;
    }

    guessMapCandidates.sort((a, b) => {
      const aDist = (window.innerWidth - a.rect.left) + (window.innerHeight - a.rect.top);
      const bDist = (window.innerWidth - b.rect.left) + (window.innerHeight - b.rect.top);
      return aDist - bDist;
    });

    return guessMapCandidates[0].el;
  }

  function simulateClick(element, clientX, clientY) {
    // Pointer events
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      try {
        const event = new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: clientX,
          clientY: clientY,
          button: 0,
          buttons: type.includes('down') ? 1 : 0,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true
        });
        element.dispatchEvent(event);
      } catch (e) {}
    }

    // Mouse events
    for (const type of ['mousedown', 'mouseup', 'click']) {
      try {
        const event = new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: clientX,
          clientY: clientY,
          button: 0
        });
        element.dispatchEvent(event);
      } catch (e) {}
    }

    // Dispatch to element at position
    const targetEl = document.elementFromPoint(clientX, clientY);
    if (targetEl && targetEl !== element) {
      for (const type of ['mousedown', 'mouseup', 'click']) {
        try {
          const event = new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: clientX,
            clientY: clientY,
            button: 0
          });
          targetEl.dispatchEvent(event);
        } catch (e) {}
      }
    }
  }

  function openGuessMap() {
    const buttons = document.querySelectorAll('button, [role="button"]');
    
    for (const btn of buttons) {
      if (btn.offsetParent === null) continue;
      
      const rect = btn.getBoundingClientRect();
      const text = (btn.innerText || '').toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      
      if (rect.top > window.innerHeight * 0.5 && rect.width < 100 && rect.height < 100) {
        if (text.includes('map') || text.includes('open') || ariaLabel.includes('map') ||
            btn.querySelector('svg') || btn.querySelector('[class*="map"]')) {
          btn.click();
          return true;
        }
      }
    }
    
    return false;
  }

})();
