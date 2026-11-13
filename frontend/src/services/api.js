// Calls to the Python backend. Vite proxies /api to it in development.

import { useEffect, useState } from 'react';

const NO_SERVER = 'Can’t reach the picture server. Check that the backend is running, then try again.';
const POLL_MS = 3000;

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error(NO_SERVER);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    // The dev proxy answers 500 with no JSON when the backend is down.
    throw new Error((body && (body.error || body.detail)) || NO_SERVER);
  }
  return { status: res.status, body };
}

const sendJson = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// ---- Saved projects (stored in Supabase by the backend) ----

export const listProjects = async () => (await request('/api/projects')).body;
export const createProject = async (fields) => (await request('/api/projects', sendJson('POST', fields))).body;
export const patchProject = async (id, fields) => (await request(`/api/projects/${id}`, sendJson('PATCH', fields))).body;
export const removeProject = async (id) => (await request(`/api/projects/${id}`, { method: 'DELETE' })).body;

// ---- Sky pictures (real SPHEREx data from NASA/IPAC IRSA) ----

const done = new Map();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// GET a sky endpoint. The first time anyone looks at a spot, the backend downloads its pictures
// from NASA and answers 202 with progress; this keeps asking every few seconds and reports
// progress via onProgress({ cached_images, total_images }). Finished results are remembered,
// so flipping between bands or pages doesn't reload them. isCancelled() stops the polling.
async function poll(url, onProgress = () => {}, isCancelled = () => false) {
  if (done.has(url)) return done.get(url);
  for (;;) {
    const { status, body } = await request(url);
    if (status !== 202) {
      done.set(url, body);
      return body;
    }
    onProgress(body);
    await wait(POLL_MS);
    if (isCancelled()) return null;
  }
}

const spot = (ra, dec, more) => new URLSearchParams({ ra: ra.toFixed(6), dec: dec.toFixed(6), fov: '5.0', ...more }).toString();
const LOOK = { stretch: 'zscale', colormap: 'grayscale' };

// The time series of pictures for one sky position, plus difference_image_url.
// `band` is any band_group the backend knows: 'stacked', 'array_1'..'array_6', or an id from fetchLightKinds().
export const fetchSkyCutout = (ra, dec, band = 'stacked', onProgress, isCancelled) =>
  poll(`/api/sky-cutout?${spot(ra, dec, { band_group: band, ...LOOK, epochs: '4' })}`, onProgress, isCancelled);

// { unit, channels: [{ channel, detector, wavelength_um, flux_mjy_sr, n_measurements }] }.
// Needs every picture of the spot, so the first request can report progress for 15 minutes or more.
export const fetchSpectrum = (ra, dec, onProgress, isCancelled) => poll(`/api/spectrum?${spot(ra, dec)}`, onProgress, isCancelled);

// { sources: [{ id, catalog, pixel_x, pixel_y, mag, mag_band, ... }] } with pixels on the pictures' 0-256 grid.
export const fetchCatalog = (ra, dec) => poll(`/api/catalog-overlay?${spot(ra, dec)}`);

// All pictures of the spot added together after sliding each one by (shiftX, shiftY) pixels per visit.
export const fetchShiftAndAdd = (ra, dec, band, shiftX, shiftY, onProgress, isCancelled) =>
  poll(`/api/shift-and-add?${spot(ra, dec, { band_group: band, shift_x: shiftX, shift_y: shiftY, ...LOOK })}`, onProgress, isCancelled);

// Every kind of light the backend can show: { id: { name, category, description } }.
export const fetchLightKinds = async () => (await poll('/api/bands')).wavelength_filters;

// ---- Things people have flagged (stored in Supabase by the backend) ----

// Flags near a position (within the 5 arcminute picture), or every flag when ra is null.
export const listCandidates = async (ra, dec) =>
  (await request(ra == null ? '/api/candidates' : `/api/candidates?ra=${ra}&dec=${dec}&radius_deg=0.06`)).body;
export const voteCandidate = async (id) => (await request(`/api/candidates/${id}/vote`, sendJson('POST', {}))).body;

// Flags the point (x, y) on the 0-256 picture grid of the picture centred on (ra, dec).
export async function flagCandidate(ra, dec, x, y, fields) {
  const where = (await request(`/api/pixel-to-radec?pixel_x=${x}&pixel_y=${y}&center_ra=${ra}&center_dec=${dec}`)).body;
  const { ra_deg, dec_deg, ra_hms, dec_dms } = where;
  return (await request('/api/candidates', sendJson('POST', { ra_deg, dec_deg, ra_hms, dec_dms, pixel_x: x, pixel_y: y, ...fields }))).body;
}

// ---- Loading hooks ----

const IDLE = { data: null, error: null, loading: false, progress: null };

// Runs load(onProgress, isCancelled) whenever `key` changes. Pass key = null to load nothing.
// Returns { data, error, loading, progress, retry }. The last result stays on screen while the
// next one loads, unless the backend reports a download in progress.
export function useRemote(key, load) {
  const [state, setState] = useState(IDLE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key == null) {
      setState(IDLE);
      return;
    }
    let current = true;
    setState((s) => ({ ...s, error: null, loading: true, progress: null }));
    load((progress) => current && setState({ ...IDLE, loading: true, progress }), () => !current).then(
      (data) => current && setState({ ...IDLE, data }),
      (err) => current && setState({ ...IDLE, error: err.message })
    );
    return () => {
      current = false;
    };
  }, [key, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

// Loads the pictures for a position. Returns { frames, difference, error, loading, progress, retry }.
// frames: [{ image_url, timestamp }] oldest first. difference: picture URL or null.
// progress: null or { cached_images, total_images }. Pass ra = null to load nothing.
export function useFrames(ra, dec, band = 'stacked') {
  const { data, ...rest } = useRemote(ra == null || dec == null ? null : `${ra}|${dec}|${band}`, (onProgress, isCancelled) =>
    fetchSkyCutout(ra, dec, band, onProgress, isCancelled)
  );
  return { frames: (data && data.epochs) || [], difference: (data && data.difference_image_url) || null, ...rest };
}
