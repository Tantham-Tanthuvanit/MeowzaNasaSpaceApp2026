// Loads the real SPHEREx all-sky picture from NASA's archive (IRSA), straight into the browser.
// It is IRSA's "SPHEREx DR1 all-sky data cube"; the map uses its first layer (0.75 micron light).
// Everything is kept in memory for the page's lifetime, so going back to Home does not reload it.

import { TILE_PX, PREVIEW_COLS, PREVIEW_TILES, MAX_ORDER, makeLut } from '../core/skyImage';

const BASE = 'https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube';
const PARALLEL = 4; // tiles downloaded at once, as a courtesy to IRSA
const KEEP = 150; // sharp tiles kept in memory (about 40 MB) before unused ones are dropped

// Download a PNG and return its brightness (one byte per pixel).
async function loadGrey(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const data = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < data.length; i++) data[i] = (rgba[i * 4] * rgba[i * 4 + 3] + 127) / 255;
  return { data, width: canvas.width, height: canvas.height };
}

// Halve a picture by averaging each 2 x 2 block. Used to calm the speckle when zoomed out.
function halve({ data, width, height, cell }) {
  const w = width / 2, h = height / 2, out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = 2 * y * width + 2 * x;
    out[y * w + x] = (data[i] + data[i + 1] + data[i + width] + data[i + width + 1] + 2) >> 2;
  }
  return { data: out, width: w, height: h, cell: cell / 2 };
}

let skyPromise = null;

// The whole sky at low detail: one 1 MB picture. Resolves to the `src` that renderSky() draws from.
export function loadSky() {
  skyPromise ??= loadGrey(`${BASE}/Norder3/Allsky.png`).then((full) => {
    const rows = Math.ceil(PREVIEW_TILES / PREVIEW_COLS);
    if (full.width !== PREVIEW_COLS * 64 || full.height !== rows * 64) throw new Error('unexpected picture size');
    const mips = [{ ...full, cell: 64 }];
    while (mips.length < 3) mips.push(halve(mips[mips.length - 1]));
    const tiles = {};
    for (let k = 1; k <= MAX_ORDER; k++) tiles[k] = new Array(12 * 4 ** k);
    return { mips, tiles, lut: makeLut() };
  }).catch((err) => {
    skyPromise = null; // let "Try again" start over
    throw err;
  });
  return skyPromise;
}

const state = {}; // "order/n" -> 'loading' | 'failed'
let queue = [];
let running = 0;
let count = 0;

function pump(src, onChange) {
  while (running < PARALLEL && queue.length) {
    const [order, n] = queue.shift();
    const key = `${order}/${n}`;
    if (state[key] || src.tiles[order][n]) continue;
    state[key] = 'loading';
    running++;
    loadGrey(`${BASE}/Norder${order}/Dir${Math.floor(n / 10000) * 10000}/Npix${n}.png`).then((tile) => {
      if (tile.width !== TILE_PX || tile.height !== TILE_PX) throw new Error('unexpected tile size');
      src.tiles[order][n] = tile.data;
      count++;
      delete state[key];
      onChange(true);
    }).catch(() => {
      state[key] = 'failed';
      onChange(false);
    }).finally(() => {
      running--;
      pump(src, onChange);
    });
  }
}

// Ask for the sharp tiles a view wants (wanted[order][n] === 1). Tiles still waiting from an
// earlier view are dropped. onChange(ok) runs as each tile arrives or fails.
// Returns how many wanted tiles have failed to load and how many are still on their way.
export function requestTiles(src, wanted, order, onChange) {
  const flags = wanted[order];
  queue = [];
  let failed = 0, pending = 0;
  for (let n = 0; n < flags.length; n++) {
    if (!flags[n] || src.tiles[order][n]) continue;
    const s = state[`${order}/${n}`];
    if (s === 'failed') { failed++; continue; }
    pending++;
    if (!s) queue.push([order, n]);
  }
  // Free memory: drop tiles this view does not use once there are too many.
  for (let k = 1; k <= MAX_ORDER && count > KEEP; k++) {
    for (let n = 0; n < src.tiles[k].length && count > KEEP; n++) {
      if (src.tiles[k][n] && !(k === order && flags[n])) { src.tiles[k][n] = undefined; count--; }
    }
  }
  pump(src, onChange);
  return { failed, pending };
}

// Forget which tiles failed, so the next request tries them again.
export function retryTiles() {
  for (const key of Object.keys(state)) if (state[key] === 'failed') delete state[key];
}
