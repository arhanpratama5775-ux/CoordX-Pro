/**
 * CoordX Pro — Content Script (v1.2.8)
 * 
 * Fixed injection issues with better error handling
 */

(function () {
  'use strict';

  // Use unique variable name to avoid conflicts
  if (window.__coordxProV128Injected) {
    console.log('[CoordX Pro] Already injected, skipping');
    return;
  }
  window.__coordxProV128Injected = true;

  // Log immediately to verify script is running
  console.log('[CoordX Pro] 🚀 Content script v1.2.8 STARTING on:', window.location.href);
  console.log('[CoordX Pro] Document readyState:', document.readyState);

  // Wrap everything in try-catch
  try {

    function isValidCoord(lat, lng) {
      return (
        !isNaN(lat) && !isNaN(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180 &&
        !(lat === 0 && lng === 0) &&
        Math.abs(lat) > 0.001 &&
        Math.abs(lng) > 0.001
      );
    }

    let lastSentCoords = null;
    let lastIframeSrc = null;
    let allRounds = [];
    let currentRoundIndex = 0;

    function sendCoords(lat, lng, source) {
      if (!isValidCoord(lat, lng)) return;

      const isDifferent = !lastSentCoords || 
          Math.abs(lastSentCoords.lat - lat) > 0.0001 ||
          Math.abs(lastSentCoords.lng - lng) > 0.0001;

      if (!isDifferent) return;

      lastSentCoords = { lat, lng };
      console.log('[CoordX Pro] ✅ SENDING COORDS:', lat, lng, 'via', source);

      try {
        chrome.runtime.sendMessage({
          type: 'contentCoords',
          lat,
          lng,
          source
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('[CoordX Pro] Send warning:', chrome.runtime.lastError.message);
          }
        });
      } catch (e) {
        console.error('[CoordX Pro] Send error:', e);
      }
    }

    function forceSendCoords(lat, lng, source) {
      lastSentCoords = null;
      sendCoords(lat, lng, source);
    }

    /* ─── Parse round indicator from DOM ─── */

    function parseRoundIndicator() {
      try {
        const allText = document.body?.innerText || '';
        const match = allText.match(/ROUND\s*(\d+)\s*[\/\|]\s*(\d+)/i);
        if (match) {
          const current = parseInt(match[1]);
          const total = parseInt(match[2]);
          console.log('[CoordX Pro] 📊 Detected round:', current, '/', total);
          return { current, total };
        }
      } catch (e) {}
      return null;
    }

    function getCurrentRoundFromDOM() {
      const indicator = parseRoundIndicator();
      if (indicator) {
        return indicator.current - 1;
      }
      return currentRoundIndex;
    }

    /* ─── Load rounds from __NEXT_DATA__ ─── */

    function loadAllRoundsFromNextData() {
      console.log('[CoordX Pro] Loading rounds from __NEXT_DATA__...');
      
      const script = document.getElementById('__NEXT_DATA__');
      if (!script) {
        console.log('[CoordX Pro] ❌ No __NEXT_DATA__ element found');
        return false;
      }

      try {
        const data = JSON.parse(script.textContent);
        console.log('[CoordX Pro] Parsed __NEXT_DATA__, checking structure...');
        
        const props = data.props?.pageProps;
        if (!props) {
          console.log('[CoordX Pro] ❌ No pageProps');
          return false;
        }

        const gameSnapshot = props.gameSnapshot;
        if (!gameSnapshot) {
          console.log('[CoordX Pro] ❌ No gameSnapshot');
          return false;
        }

        const rounds = gameSnapshot.rounds;
        if (!rounds || !Array.isArray(rounds)) {
          console.log('[CoordX Pro] ❌ No rounds array');
          return false;
        }

        // Store all rounds
        allRounds = rounds.map((r, i) => {
          const lat = r.lat;
          const lng = r.lng;
          console.log('[CoordX Pro] Round', i + 1, ':', lat, lng);
          return { lat, lng };
        }).filter(r => isValidCoord(r.lat, r.lng));

        console.log('[CoordX Pro] ✅ Loaded', allRounds.length, 'valid rounds');

        // Get current round from DOM
        const domRound = getCurrentRoundFromDOM();
        currentRoundIndex = Math.max(0, domRound);
        console.log('[CoordX Pro] Current round index:', currentRoundIndex);

        sendCurrentRound('loaded');
        return true;

      } catch (e) {
        console.error('[CoordX Pro] Parse error:', e);
      }

      return false;
    }

    function sendCurrentRound(source) {
      if (allRounds.length === 0) {
        console.log('[CoordX Pro] No rounds loaded');
        return;
      }

      // Check DOM for current round
      const domRound = getCurrentRoundFromDOM();
      if (domRound >= 0 && domRound < allRounds.length && domRound !== currentRoundIndex) {
        console.log('[CoordX Pro] Round changed from DOM:', currentRoundIndex + 1, '->', domRound + 1);
        currentRoundIndex = domRound;
      }

      const round = allRounds[currentRoundIndex];
      if (round && isValidCoord(round.lat, round.lng)) {
        console.log('[CoordX Pro] 📍 Sending round', currentRoundIndex + 1, ':', round.lat, round.lng);
        forceSendCoords(round.lat, round.lng, 'geoguessr_' + source + '_r' + (currentRoundIndex + 1));
      }
    }

    /* ─── WorldGuessr: Iframe Detection ─── */

    function extractFromIframeSrc(src) {
      if (!src) return null;
      const match = src.match(/location=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (isValidCoord(lat, lng)) {
          return { lat, lng };
        }
      }
      return null;
    }

    function checkIframe() {
      try {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          if (iframe.src && iframe.src.includes('location=')) {
            if (lastIframeSrc !== iframe.src) {
              lastIframeSrc = iframe.src;
              const coords = extractFromIframeSrc(iframe.src);
              if (coords) {
                sendCoords(coords.lat, coords.lng, 'worldguessr_iframe');
                return true;
              }
            }
          }
        }
      } catch (e) {}
      return false;
    }

    /* ─── Network Hooks via Page Script ─── */

    function injectPageScript() {
      console.log('[CoordX Pro] Injecting page script...');
      
      const script = document.createElement('script');
      script.id = 'coordx-page-script';

      script.textContent = `
(function() {
  if (window.__coordxPageV128) return;
  window.__coordxPageV128 = true;

  console.log('[CoordX Pro] Page script v1.2.8 injected');

  function isValidCoord(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001;
  }

  function sendCoords(lat, lng, source, round) {
    console.log('[CoordX Pro] 📍 Found:', lat, lng, 'round:', round, 'via', source);
    window.dispatchEvent(new CustomEvent('__coordx_coords', {
      detail: { lat, lng, source, round }
    }));
  }

  function processGeoGuessrResponse(data) {
    if (data.gameSnapshot && data.gameSnapshot.rounds) {
      data.gameSnapshot.rounds.forEach((r, i) => {
        if (isValidCoord(r.lat, r.lng)) {
          sendCoords(r.lat, r.lng, 'api', i + 1);
        }
      });
    }
    if (data.rounds && Array.isArray(data.rounds)) {
      data.rounds.forEach((r, i) => {
        if (isValidCoord(r.lat, r.lng)) {
          sendCoords(r.lat, r.lng, 'rounds', i + 1);
        }
      });
    }
    if (isValidCoord(data.lat, data.lng)) {
      sendCoords(data.lat, data.lng, 'single', null);
    }
  }

  function processResponse(text) {
    if (!text) return;
    try {
      const data = JSON.parse(text);
      processGeoGuessrResponse(data);
    } catch (e) {}
  }

  // Hook fetch
  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await _fetch.apply(this, arguments);
    
    if (url.includes('geoguessr')) {
      console.log('[CoordX Pro] 🔍 Fetch:', url);
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        processResponse(text);
      } catch (e) {}
    }
    
    return response;
  };

  // Hook XHR
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._coordx_url = url;
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    const xhr = this;
    xhr.addEventListener('load', function() {
      if (xhr._coordx_url && xhr._coordx_url.includes('geoguessr')) {
        processResponse(xhr.responseText);
      }
    });
    return _send.apply(this, arguments);
  };

  console.log('[CoordX Pro] ✅ Network hooks installed');
})();
`;

      try {
        (document.head || document.documentElement).appendChild(script);
        script.remove();
        console.log('[CoordX Pro] Page script injected successfully');
      } catch (e) {
        console.error('[CoordX Pro] Failed to inject page script:', e);
      }
    }

    // Listen for coordinates from page script
    window.addEventListener('__coordx_coords', (event) => {
      try {
        const { lat, lng, source, round } = event.detail;
        if (round && allRounds.length > 0) {
          const roundIdx = round - 1;
          if (roundIdx > currentRoundIndex && roundIdx < allRounds.length) {
            currentRoundIndex = roundIdx;
            forceSendCoords(lat, lng, source + '_r' + round);
            return;
          }
        }
        sendCoords(lat, lng, source);
      } catch (e) {}
    });

    /* ─── Click Listener ─── */

    function setupClickListener() {
      document.addEventListener('click', (e) => {
        try {
          const target = e.target;
          const text = (target.innerText || target.textContent || '').toUpperCase().trim();
          
          if (text === 'NEXT' || text.includes('NEXT')) {
            console.log('[CoordX Pro] 🖱️ NEXT button clicked!');
            
            setTimeout(() => {
              const domRound = getCurrentRoundFromDOM();
              if (domRound !== currentRoundIndex && domRound >= 0) {
                currentRoundIndex = domRound;
              }
              sendCurrentRound('click');
            }, 300);
            
            setTimeout(() => {
              sendCurrentRound('click2');
            }, 800);
          }
        } catch (e) {}
      }, true);
    }

    /* ─── Main Logic ─── */

    function main() {
      console.log('[CoordX Pro] main() called');
      
      const hostname = window.location.hostname;
      console.log('[CoordX Pro] Hostname:', hostname);

      // Inject page script first
      injectPageScript();

      if (hostname.includes('geoguessr.com')) {
        console.log('[CoordX Pro] GeoGuessr detected');
        
        // Try loading rounds
        loadAllRoundsFromNextData();
        
        // Retry loading
        setTimeout(loadAllRoundsFromNextData, 500);
        setTimeout(loadAllRoundsFromNextData, 1000);
        setTimeout(loadAllRoundsFromNextData, 2000);

        setupClickListener();

        // Check for round changes
        setInterval(() => {
          const domRound = getCurrentRoundFromDOM();
          if (domRound !== currentRoundIndex && domRound >= 0 && domRound < allRounds.length) {
            console.log('[CoordX Pro] Round changed:', currentRoundIndex + 1, '->', domRound + 1);
            currentRoundIndex = domRound;
            sendCurrentRound('dom');
          }
        }, 500);

        // Periodic send
        setInterval(() => {
          if (allRounds.length > 0) {
            sendCurrentRound('periodic');
          }
        }, 3000);
      }

      if (hostname.includes('worldguessr.com')) {
        console.log('[CoordX Pro] WorldGuessr detected');
        setInterval(checkIframe, 500);
      }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        console.log('[CoordX Pro] DOM loaded, starting...');
        main();
      });
    } else {
      console.log('[CoordX Pro] DOM already ready, starting...');
      main();
    }

  } catch (err) {
    console.error('[CoordX Pro] ❌ FATAL ERROR:', err);
  }

})();
