import { useEffect, useState } from 'react';

// ============================================================
// Google Maps JS API loader
//
// The key is NOT baked into the bundle - it is stored in track_settings and
// served by GET /field-tracking/config, so a Super Admin can rotate it without
// a redeploy. It is a BROWSER key and is visible to anyone who opens this
// screen, exactly like any web maps key; it must be HTTP-referrer restricted in
// the Google Cloud console.
//
// The script tag can only be injected once per page load, and Google throws
// "You have included the Google Maps JavaScript API multiple times" if it is
// not. One module-level promise is shared by every component that asks.
// ============================================================

const SCRIPT_ID = 'google-maps-js-sdk';

let loadPromise = null;
let loadedKey = null;

export const loadGoogleMaps = (apiKey) => {
  if (!apiKey) return Promise.reject(new Error('NO_KEY'));

  // Already up with this key - reuse it.
  if (window.google?.maps && loadedKey === apiKey) return Promise.resolve(window.google.maps);

  // A key change needs a full page reload; Google has no way to swap the key on
  // an already-loaded SDK. Tell the caller rather than silently using the old one.
  if (loadPromise && loadedKey !== apiKey) {
    return Promise.reject(new Error('KEY_CHANGED_RELOAD_REQUIRED'));
  }

  if (loadPromise) return loadPromise;

  loadedKey = apiKey;
  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.maps));
      existing.addEventListener('error', () => reject(new Error('SCRIPT_ERROR')));
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    // `geometry` powers the polyline helpers; `places` powers the address search
    // box on the location picker.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry,places&loading=async&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error('SDK_MISSING_AFTER_LOAD'));
    };
    script.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever.
      loadPromise = null;
      loadedKey = null;
      reject(new Error('SCRIPT_ERROR'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
};

/**
 * @param {string|null} apiKey  from GET /field-tracking/config
 * @returns {{ maps: object|null, loading: boolean, error: string|null }}
 */
const useGoogleMaps = (apiKey) => {
  const [state, setState] = useState({ maps: null, loading: Boolean(apiKey), error: apiKey ? null : 'NO_KEY' });

  useEffect(() => {
    let cancelled = false;
    if (!apiKey) {
      setState({ maps: null, loading: false, error: 'NO_KEY' });
      return undefined;
    }

    setState({ maps: null, loading: true, error: null });
    loadGoogleMaps(apiKey)
      .then((maps) => { if (!cancelled) setState({ maps, loading: false, error: null }); })
      .catch((err) => { if (!cancelled) setState({ maps: null, loading: false, error: err.message }); });

    return () => { cancelled = true; };
  }, [apiKey]);

  return state;
};

export const mapsErrorMessage = (code) => ({
  NO_KEY: 'No Google Maps key is configured. Add one under Field Tracking → Settings.',
  SCRIPT_ERROR: 'Google Maps failed to load. Check the API key, its referrer restrictions and that billing is enabled.',
  SDK_MISSING_AFTER_LOAD: 'Google Maps loaded but did not initialise. Check the key restrictions.',
  KEY_CHANGED_RELOAD_REQUIRED: 'The Maps key changed. Reload the page to apply it.',
}[code] || 'Google Maps is unavailable.');

export default useGoogleMaps;
