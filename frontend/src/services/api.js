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

const cutouts = new Map();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The time series of pictures for one sky position. `band` is 'stacked' or 'array_1'..'array_6'.
// The first time anyone looks at a spot, the backend downloads its pictures from NASA and
// answers 202 with progress; this keeps asking every few seconds and reports progress via
// onProgress({ cached_images, total_images }). Finished results are remembered, so flipping
// between bands or pages doesn't reload them. isCancelled() stops the polling.
export async function fetchSkyCutout(ra, dec, band = 'stacked', onProgress = () => {}, isCancelled = () => false) {
  const query = new URLSearchParams({
    ra: ra.toFixed(6),
    dec: dec.toFixed(6),
    fov: '5.0',
    band_group: band,
    stretch: 'zscale',
    colormap: 'grayscale',
    epochs: '4',
  }).toString();
  if (cutouts.has(query)) return cutouts.get(query);
  for (;;) {
    const { status, body } = await request(`/api/sky-cutout?${query}`);
    if (status !== 202) {
      cutouts.set(query, body);
      return body;
    }
    onProgress(body);
    await wait(POLL_MS);
    if (isCancelled()) return null;
  }
}

// Loads the pictures for a position. Returns { frames, error, loading, progress, retry }.
// frames: [{ image_url, timestamp }] oldest first. progress: null or { cached_images, total_images }.
// Pass ra = null to load nothing.
export function useFrames(ra, dec, band = 'stacked') {
  const [state, setState] = useState({ frames: [], error: null, loading: false, progress: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (ra == null || dec == null) {
      setState({ frames: [], error: null, loading: false, progress: null });
      return;
    }
    let current = true;
    setState((s) => ({ ...s, error: null, loading: true, progress: null }));
    fetchSkyCutout(ra, dec, band, (progress) => current && setState((s) => ({ ...s, progress })), () => !current).then(
      (data) => current && setState({ frames: data.epochs || [], error: null, loading: false, progress: null }),
      (err) => current && setState({ frames: [], error: err.message, loading: false, progress: null })
    );
    return () => {
      current = false;
    };
  }, [ra, dec, band, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
