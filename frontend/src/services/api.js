// Calls to the Python backend. Vite proxies /api to it in development.

import { useEffect, useState } from 'react';

const NO_SERVER = 'Can’t reach the picture server. Check that the backend is running, then try again.';

async function getJson(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(NO_SERVER);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    // The dev proxy answers 500 with no JSON when the backend is down.
    throw new Error((body && (body.error || body.detail)) || NO_SERVER);
  }
  return body;
}

// The backend's list of well-known targets.
export function fetchPresets() {
  return getJson('/api/presets');
}

const cutouts = new Map();

// The time series of pictures for one sky position. `band` is 'stacked' or 'array_1'..'array_6'.
// Results are remembered, so flipping between bands or pages doesn't reload them.
export function fetchSkyCutout(ra, dec, band = 'stacked') {
  const query = new URLSearchParams({
    ra: ra.toFixed(6),
    dec: dec.toFixed(6),
    fov: '5.0',
    band_group: band,
    stretch: 'zscale',
    colormap: 'grayscale',
    epochs: '4',
  }).toString();
  if (!cutouts.has(query)) {
    const request = getJson(`/api/sky-cutout?${query}`);
    request.catch(() => cutouts.delete(query));
    cutouts.set(query, request);
  }
  return cutouts.get(query);
}

// Loads the pictures for a position. Returns { frames, error, loading, retry }.
// frames: [{ image_url, timestamp }] oldest first. Pass ra = null to load nothing.
export function useFrames(ra, dec, band = 'stacked') {
  const [state, setState] = useState({ frames: [], error: null, loading: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (ra == null || dec == null) {
      setState({ frames: [], error: null, loading: false });
      return;
    }
    let current = true;
    setState((s) => ({ ...s, error: null, loading: true }));
    fetchSkyCutout(ra, dec, band).then(
      (data) => current && setState({ frames: data.epochs || [], error: null, loading: false }),
      (err) => current && setState({ frames: [], error: err.message, loading: false })
    );
    return () => {
      current = false;
    };
  }, [ra, dec, band, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
