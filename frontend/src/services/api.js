/**
 * api.js — NASA SPHEREx Sky Viewer Frontend API Service.
 *
 * Centralizes all REST API interactions with the backend, with seamless fallback
 * to realistic mock data if the backend is temporarily offline or in standalone UI mode.
 */

import { MOCK_PRESETS, MOCK_DETECTOR_ARRAYS, createMockSkyCutout } from './mockData';

const API_BASE = '';

/**
 * Fetch official benchmark challenge targets.
 */
export async function fetchPresets() {
  try {
    const res = await fetch(`${API_BASE}/api/presets`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API Service] Backend unavailable for /api/presets, using mock presets:', err.message);
    return MOCK_PRESETS;
  }
}

/**
 * Fetch 102-channel detector array specifications.
 */
export async function fetchDetectorBands() {
  try {
    const res = await fetch(`${API_BASE}/api/bands`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API Service] Backend unavailable for /api/bands, using mock band data:', err.message);
    return {
      mission: 'NASA SPHEREx',
      total_bands: 102,
      wavelength_range_um: [0.75, 5.00],
      detector_arrays: MOCK_DETECTOR_ARRAYS
    };
  }
}

/**
 * Fetch multi-epoch cutouts, difference image, and 102-band SED.
 */
export async function fetchSkyCutout({
  ra,
  dec,
  fov = 5.0,
  bandGroup = 'stacked',
  stretch = 'zscale',
  colormap = 'inferno',
  epochs = 4
}) {
  const query = new URLSearchParams({
    ra: ra.trim(),
    dec: dec.trim(),
    fov: fov.toString(),
    band_group: bandGroup,
    stretch,
    colormap,
    epochs: epochs.toString()
  });

  try {
    const res = await fetch(`${API_BASE}/api/sky-cutout?${query.toString()}`);
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.detail || errorJson.error || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn(`[API Service] Live API request failed (${err.message}). Falling back to simulation mock.`);
    // If backend fails or is not yet started, return rich mock data matching the query coordinates
    const fallback = createMockSkyCutout(ra, dec, fov);
    fallback.target_info.band_group = bandGroup;
    fallback.target_info.stretch = stretch;
    fallback.target_info.colormap = colormap;
    return fallback;
  }
}

/**
 * Helper to update browser URL query params without triggering a page reload.
 */
export function syncUrlWithQuery(ra, dec, fov, band) {
  const params = new URLSearchParams(window.location.search);
  if (ra) params.set('ra', ra);
  if (dec) params.set('dec', dec);
  if (fov) params.set('fov', fov.toString());
  if (band) params.set('band', band);

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}

/**
 * Helper to read coordinates and view options from initial URL parameters.
 */
export function readInitialUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    ra: params.get('ra') || '08h55m10.831s',
    dec: params.get('dec') || '-07d14m42.53s',
    fov: params.get('fov') ? parseFloat(params.get('fov')) : 5.0,
    band: params.get('band') || 'stacked',
    hasCustomCoords: Boolean(params.get('ra') && params.get('dec'))
  };
}
