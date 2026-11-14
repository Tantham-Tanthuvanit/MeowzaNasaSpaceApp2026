// Loads real all-sky HiPS pictures from NASA's archive (IRSA), straight into the browser:
// - Visible light: DSS2 Color (STScI/NASA Optical, full-color RGB JPEG tiles)
// - Infrared: NASA SPHEREx DR1 all-sky data cube (0.75 micron PNG tiles)
// Everything is kept in memory per survey for the page's lifetime so toggling back is instant.

import { TILE_PX, PREVIEW_COLS, PREVIEW_TILES, MAX_ORDER, makeLut, makeRgbLut, packRgb, halveRgb } from '../core/skyImage';

export const SURVEYS = {
  visible: {
    id: 'visible',
    label: 'Visible light',
    caption: 'Real picture of the sky in visible light · DSS2 (NASA/STScI)',
    base: 'https://irsa.ipac.caltech.edu/data/hips/CDS/DSS2/color',
    ext: 'jpg',
    rgb: true,
  },
  infrared: {
    id: 'infrared',
    label: 'Infrared (SPHEREx)',
    caption: 'Real picture of the sky in infrared light · NASA SPHEREx',
    base: 'https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube',
    ext: 'png',
    rgb: false,
  },
};

const PARALLEL = 4; // tiles downloaded at once, as a courtesy to IRSA
const KEEP = 150; // sharp tiles kept in memory per survey before unused ones are dropped
const RGB_LUT = makeRgbLut();

async function decodeRgba(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return {
    rgba: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width,
    height: canvas.height,
  };
}

// Download a PNG and return its brightness (one byte per pixel).
async function loadGrey(url) {
  const { rgba, width, height } = await decodeRgba(url);
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) data[i] = (rgba[i * 4] * rgba[i * 4 + 3] + 127) / 255;
  return { data, width, height };
}

// Download a JPEG/PNG and return tone-mapped packed 32-bit RGBA pixels.
async function loadRgb(url) {
  const { rgba, width, height } = await decodeRgba(url);
  return { data: packRgb(rgba, RGB_LUT), width, height };
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

const skyPromises = {};

// The whole sky at low detail: one ~1 MB picture. Resolves to the `src` that renderSky() draws from.
export function loadSky(survey = 'visible') {
  const key = SURVEYS[survey] ? survey : 'visible';
  const cfg = SURVEYS[key];
  skyPromises[key] ??= (cfg.rgb ? loadRgb : loadGrey)(`${cfg.base}/Norder3/Allsky.${cfg.ext}`).then((full) => {
    const rows = Math.ceil(PREVIEW_TILES / PREVIEW_COLS);
    if (full.width !== PREVIEW_COLS * 64 || full.height !== rows * 64) throw new Error('unexpected picture size');
    const mips = [{ ...full, cell: 64 }];
    const halveFn = cfg.rgb ? halveRgb : halve;
    while (mips.length < 3) mips.push(halveFn(mips[mips.length - 1]));
    const tiles = {};
    for (let k = 1; k <= MAX_ORDER; k++) tiles[k] = new Array(12 * 4 ** k);
    return { survey: key, cfg, mips, tiles, lut: cfg.rgb ? null : makeLut(), state: {}, count: 0 };
  }).catch((err) => {
    delete skyPromises[key]; // let "Try again" start over
    throw err;
  });
  return skyPromises[key];
}

let queue = [];
let running = 0;
let currentSrc = null;
let currentOnChange = null;

function pump() {
  const src = currentSrc;
  const onChange = currentOnChange;
  if (!src || !onChange) return;
  while (running < PARALLEL && queue.length) {
    const [order, n] = queue.shift();
    const key = `${order}/${n}`;
    if (src.state[key] || src.tiles[order][n]) continue;
    src.state[key] = 'loading';
    running++;
    const url = `${src.cfg.base}/Norder${order}/Dir${Math.floor(n / 10000) * 10000}/Npix${n}.${src.cfg.ext}`;
    (src.cfg.rgb ? loadRgb : loadGrey)(url).then((tile) => {
      if (tile.width !== TILE_PX || tile.height !== TILE_PX) throw new Error('unexpected tile size');
      src.tiles[order][n] = tile.data;
      src.count++;
      delete src.state[key];
      if (src === currentSrc) onChange(true);
    }).catch(() => {
      src.state[key] = 'failed';
      if (src === currentSrc) onChange(false);
    }).finally(() => {
      running--;
      pump();
    });
  }
}

// Ask for the sharp tiles a view wants (wanted[order][n] === 1). Tiles still waiting from an
// earlier view are dropped. onChange(ok) runs as each tile arrives or fails.
// Returns how many wanted tiles have failed to load and how many are still on their way.
export function requestTiles(src, wanted, order, onChange) {
  currentSrc = src;
  currentOnChange = onChange;
  const flags = wanted[order];
  queue = [];
  let failed = 0, pending = 0;
  for (let n = 0; n < flags.length; n++) {
    if (!flags[n] || src.tiles[order][n]) continue;
    const s = src.state[`${order}/${n}`];
    if (s === 'failed') { failed++; continue; }
    pending++;
    if (!s) queue.push([order, n]);
  }
  // Free memory: drop tiles this view does not use once there are too many.
  for (let k = 1; k <= MAX_ORDER && src.count > KEEP; k++) {
    for (let n = 0; n < src.tiles[k].length && src.count > KEEP; n++) {
      if (src.tiles[k][n] && !(k === order && flags[n])) { src.tiles[k][n] = undefined; src.count--; }
    }
  }
  pump();
  return { failed, pending };
}

// Forget which tiles failed, so the next request tries them again.
export function retryTiles(src) {
  if (!src?.state) return;
  for (const key of Object.keys(src.state)) if (src.state[key] === 'failed') delete src.state[key];
}
