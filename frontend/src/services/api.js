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
  fov = 12.0,
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
export async function fetchShiftAndAdd({
  ra,
  dec,
  fov = 12.0,
  shiftX = 0.0,
  shiftY = 0.0,
  bandGroup = 'stacked',
  stretch = 'zscale',
  colormap = 'inferno',
  filterMode = 'normal'
}) {
  const query = new URLSearchParams({
    ra: (ra || '').trim(),
    dec: (dec || '').trim(),
    fov: fov.toString(),
    shift_x: shiftX.toString(),
    shift_y: shiftY.toString(),
    band_group: bandGroup,
    stretch,
    colormap,
    filter_mode: filterMode
  });

  try {
    const res = await fetch(`${API_BASE}/api/shift-and-add?${query.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API Service] Failed to execute shift-and-add API:', err.message);
    return null;
  }
}

/**
 * Normalizes candidate record fields across backend snake_case and frontend camelCase.
 */
export function normalizeCandidate(c) {
  if (!c) return null;
  return {
    ...c,
    id: c.id,
    raDeg: c.ra_deg !== undefined ? c.ra_deg : c.raDeg,
    decDeg: c.dec_deg !== undefined ? c.dec_deg : c.decDeg,
    raHms: c.ra_hms || c.raHms || '',
    decDms: c.dec_dms || c.decDms || '',
    pixelX: c.pixel_x !== undefined ? c.pixel_x : (c.pixelX !== undefined ? c.pixelX : 128),
    pixelY: c.pixel_y !== undefined ? c.pixel_y : (c.pixelY !== undefined ? c.pixelY : 128),
    category: c.category || 'planet_x',
    confidence: c.confidence !== undefined ? c.confidence : 4,
    notes: c.notes || '',
    observerCallsign: c.observer_callsign || c.observerCallsign || 'Citizen Scientist',
    targetPreset: c.target_preset || c.targetPreset || '',
    bandGroup: c.band_group || c.bandGroup || 'stacked',
    epochLabel: c.epoch_label || c.epochLabel || '',
    upvotes: c.upvotes !== undefined ? c.upvotes : 1,
    createdAt: c.created_at || c.createdAt || c.flaggedAt || new Date().toISOString()
  };
}

/**
 * Fetch candidates stored in the embedded SQLite database.
 */
export async function fetchCandidatesApi({ category, ra, dec, radiusDeg } = {}) {
  const query = new URLSearchParams();
  if (category && category !== 'all') query.set('category', category);
  if (ra !== undefined && ra !== null) query.set('ra', ra.toString());
  if (dec !== undefined && dec !== null) query.set('dec', dec.toString());
  if (radiusDeg !== undefined && radiusDeg !== null) query.set('radius_deg', radiusDeg.toString());

  try {
    const res = await fetch(`${API_BASE}/api/candidates?${query.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data.map(normalizeCandidate) : [];
  } catch (err) {
    console.warn('[API Service] Failed to fetch candidates from DB:', err.message);
    return null;
  }
}

/**
 * Persist a newly flagged candidate to the database.
 */
export async function createCandidateApi(candidateData) {
  const payload = {
    id: candidateData.id,
    ra_deg: candidateData.raDeg ?? candidateData.ra_deg,
    dec_deg: candidateData.decDeg ?? candidateData.dec_deg,
    ra_hms: candidateData.raHms || candidateData.ra_hms || '',
    dec_dms: candidateData.decDms || candidateData.dec_dms || '',
    pixel_x: candidateData.pixelX ?? candidateData.pixel_x ?? 128.0,
    pixel_y: candidateData.pixelY ?? candidateData.pixel_y ?? 128.0,
    category: candidateData.category || 'planet_x',
    confidence: candidateData.confidence ?? 4,
    notes: candidateData.notes || '',
    observer_callsign: candidateData.observerCallsign || candidateData.observer_callsign || 'Citizen Scientist',
    target_preset: candidateData.targetPreset || candidateData.target_preset || '',
    band_group: candidateData.bandGroup || candidateData.band_group || 'stacked',
    epoch_label: candidateData.epochLabel || candidateData.epoch_label || '',
    upvotes: candidateData.upvotes ?? 1
  };

  try {
    const res = await fetch(`${API_BASE}/api/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return normalizeCandidate(data);
  } catch (err) {
    console.warn('[API Service] Failed to save candidate to DB:', err.message);
    return normalizeCandidate(payload);
  }
}

/**
 * Retrieve or generate a persistent unique client identifier for anti-spam voting.
 */
export function getClientVoterId() {
  try {
    let id = localStorage.getItem('spherex_client_voter_id');
    if (!id) {
      id = 'voter_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem('spherex_client_voter_id', id);
    }
    return id;
  } catch {
    return 'voter_anonymous';
  }
}

/**
 * Cast a community corroboration vote for a candidate with anti-spam voter deduplication.
 */
export async function voteCandidateApi(candidateId, { voteType = 'corroborate', voterCallsign, voterId, comment = '' } = {}) {
  try {
    const callsign = voterCallsign || localStorage.getItem('spherex_observer_callsign') || 'Citizen Scientist';
    const clientVoterId = voterId || getClientVoterId();

    const res = await fetch(`${API_BASE}/api/candidates/${encodeURIComponent(candidateId)}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vote_type: voteType,
        voter_callsign: callsign,
        voter_id: clientVoterId,
        comment
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return normalizeCandidate(data);
  } catch (err) {
    console.warn('[API Service] Failed to record vote:', err.message);
    return null;
  }
}

/**
 * Delete a candidate from the database.
 */
export async function deleteCandidateApi(candidateId) {
  try {
    const res = await fetch(`${API_BASE}/api/candidates/${encodeURIComponent(candidateId)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    console.warn('[API Service] Failed to delete candidate:', err.message);
    return false;
  }
}

/**
 * Fetch official Minor Planet Center (MPC) formatted batch report from database.
 */
export async function fetchMpcDossierApi() {
  try {
    const res = await fetch(`${API_BASE}/api/candidates/export-mpc`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    console.warn('[API Service] Failed to fetch MPC export:', err.message);
    return null;
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
    fov: params.get('fov') ? parseFloat(params.get('fov')) : 12.0,
    band: params.get('band') || 'stacked',
    hasCustomCoords: Boolean(params.get('ra') && params.get('dec'))
  };
}
