// Draws the real SPHEREx all-sky picture onto the Home map.
// The picture comes from IRSA as HiPS tiles: the sky is cut into 12 big diamonds (HEALPix faces),
// each split again and again into four. A tile at "order" k is one of 12 * 4^k diamonds, stored as
// a 512 x 512 PNG. This file turns a map pixel into the tile pixel that covers the same sky.

import { MAP_W, MAP_H, MAP_RX, MAP_RY } from './sky';

const RAD = Math.PI / 180;
const BITS = 14, FINE = 1 << BITS, TOP = FINE - 1; // every face is addressed on a 16384 x 16384 grid

export const TILE_PX = 512;
export const PREVIEW_ORDER = 3; // IRSA's whole-sky preview holds every order-3 tile, shrunk to 64 px
export const PREVIEW_COLS = 27; // ...laid out 27 tiles per row
export const PREVIEW_TILES = 768;
export const MAX_ORDER = 5; // the sharpest tiles IRSA has: about 13 arcseconds per pixel
const PREVIEW_DEG = 0.1145; // sky degrees per pixel of the 64 px preview tiles

// Z[x | y << 5] weaves two 5-bit numbers together (x on the even bits): the HEALPix "nested" order.
const Z = new Uint16Array(1024);
for (let i = 0; i < 1024; i++) {
  let v = 0;
  for (let b = 0; b < 5; b++) v |= (((i >> b) & 1) << (2 * b)) | (((i >> (b + 5)) & 1) << (2 * b + 1));
  Z[i] = v;
}

// Sky direction (z = sin Dec, phi = RA in radians) -> face << 28 | y << 14 | x on the fine grid.
function cell(z, phi) {
  let tt = phi * (2 / Math.PI);
  tt -= 4 * Math.floor(tt / 4);
  const za = z < 0 ? -z : z;
  if (za <= 2 / 3) {
    const t1 = FINE * (0.5 + tt), t2 = FINE * z * 0.75;
    const jp = Math.floor(t1 - t2), jm = Math.floor(t1 + t2);
    const ifp = jp >> BITS, ifm = jm >> BITS;
    const face = ifp === ifm ? (ifp & 3) + 4 : ifp < ifm ? ifp : ifm + 8;
    return (face << 28) | ((TOP - (jp & TOP)) << BITS) | (jm & TOP);
  }
  let ntt = tt | 0;
  if (ntt > 3) ntt = 3;
  const tp = tt - ntt, tmp = FINE * Math.sqrt(3 * (1 - za));
  let jp = (tp * tmp) | 0, jm = ((1 - tp) * tmp) | 0;
  if (jp > TOP) jp = TOP;
  if (jm > TOP) jm = TOP;
  return z >= 0 ? (ntt << 28) | ((TOP - jp) << BITS) | (TOP - jm) : ((ntt + 8) << 28) | (jm << BITS) | jp;
}

// HEALPix nested pixel number of a sky position at the given order (0 to 14).
export function nestedIndex(ra, dec, order) {
  const c = cell(Math.sin(dec * RAD), ra * RAD);
  const x = (c & TOP) >> (BITS - order), y = ((c >> BITS) & TOP) >> (BITS - order);
  let v = 0;
  for (let b = 0; b < order; b++) v += (((x >> b) & 1) + 2 * ((y >> b) & 1)) * 4 ** b;
  return (c >>> 28) * 4 ** order + v;
}

// Brightness 0-255 -> a packed RGBA pixel. Dark sky is the map's navy, bright sky is warm white.
// The curve lifts faint light so the stars away from the Milky Way stay visible.
export function makeLut() {
  const stops = [[0, 11, 18, 48], [0.4, 62, 80, 138], [0.75, 172, 184, 222], [1, 248, 243, 230]];
  const lut = new Uint32Array(256);
  for (let v = 0; v < 256; v++) {
    const t = (1 - Math.exp(-v / 80)) / (1 - Math.exp(-255 / 80));
    let i = 1;
    while (stops[i][0] < t) i++;
    const a = stops[i - 1], b = stops[i], f = (t - a[0]) / (b[0] - a[0]);
    const ch = (n) => Math.round(a[n] + (b[n] - a[n]) * f);
    lut[v] = (255 << 24) | (ch(3) << 16) | (ch(2) << 8) | ch(1);
  }
  return lut;
}

// Per-channel lookup tables (0-255 -> 0-255) for visible-light (DSS2) RGB tiles.
// Lifts faint stars and nebulae while mapping dark photographic plate background onto the #0B1230 navy floor.
export function makeRgbLut() {
  const r = new Uint8Array(256), g = new Uint8Array(256), b = new Uint8Array(256);
  const denom = 1 - Math.exp(-5);
  for (let v = 0; v < 256; v++) {
    const x = Math.max(0, (v - 6) / 249);
    const t = (1 - Math.exp(-5 * x)) / denom;
    r[v] = Math.round(11 + t * (255 - 11));
    g[v] = Math.round(18 + t * (255 - 18));
    b[v] = Math.round(48 + t * (255 - 48));
  }
  return { r, g, b };
}

// Convert an RGBA Uint8ClampedArray/Uint8Array into packed 32-bit RGBA pixels (Uint32Array).
export function packRgb(rgba, rgbLut = makeRgbLut()) {
  const { r, g, b } = rgbLut;
  const n = rgba.length >> 2;
  const out = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i << 2;
    const a = rgba[j + 3];
    const rv = ((rgba[j] * a + 127) / 255) | 0;
    const gv = ((rgba[j + 1] * a + 127) / 255) | 0;
    const bv = ((rgba[j + 2] * a + 127) / 255) | 0;
    out[i] = ((255 << 24) | (b[bv] << 16) | (g[gv] << 8) | r[rv]) >>> 0;
  }
  return out;
}

// Halve a packed-RGBA picture (Uint32Array) by averaging each 2 x 2 block per R, G, B channel.
export function halveRgb({ data, width, height, cell }) {
  const w = width / 2, h = height / 2, out = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = 2 * y * width + 2 * x;
    const p0 = data[i], p1 = data[i + 1], p2 = data[i + width], p3 = data[i + width + 1];
    const r = ((p0 & 255) + (p1 & 255) + (p2 & 255) + (p3 & 255) + 2) >> 2;
    const g = (((p0 >>> 8) & 255) + ((p1 >>> 8) & 255) + ((p2 >>> 8) & 255) + ((p3 >>> 8) & 255) + 2) >> 2;
    const b = (((p0 >>> 16) & 255) + ((p1 >>> 16) & 255) + ((p2 >>> 16) & 255) + ((p3 >>> 16) & 255) + 2) >> 2;
    out[y * w + x] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  return { data: out, width: w, height: h, cell: cell / 2 };
}

// Which tile order suits a canvas `w` pixels wide at this zoom: 0 means the preview is enough.
export function orderFor(zoom, w) {
  const degPerPx = ((2 * Math.SQRT2) / (MAP_RX * zoom) / RAD) * (MAP_W / w);
  if (degPerPx >= PREVIEW_DEG) return 0;
  return Math.min(MAX_ORDER, Math.ceil(Math.log2(PREVIEW_DEG / degPerPx)));
}

// Fill `out` (Uint32Array, w * h packed pixels) with the sky as the map shows it for `view`.
// src.mips: the preview at 64, 32, 16... px per tile, each { data, width, cell }.
// src.tiles[k][n]: brightness of tile n at order k (Uint8Array, 512 x 512), where loaded.
// wanted[k][n] is set to 1 for every tile the view would like at its ideal order.
export function renderSky(out, w, h, view, src, wanted) {
  const { rot, tilt, zoom } = view;
  const { mips, tiles, lut } = src;
  const sx = MAP_W / w, sy = MAP_H / h;
  const kx = 1 / (MAP_RX * zoom), ky = 1 / (MAP_RY * zoom);
  const ct = Math.cos(tilt * RAD), st = Math.sin(tilt * RAD), rotRad = rot * RAD;

  const order = orderFor(zoom, w);
  const degPerPx = ((2 * Math.SQRT2 * kx) / RAD) * sx;
  const mip = mips[Math.max(0, Math.min(mips.length - 1, Math.floor(Math.log2(degPerPx / PREVIEW_DEG))))];
  const mData = mip.data, mW = mip.width, mCell = mip.cell;
  const mShift = BITS - PREVIEW_ORDER - Math.log2(mCell), mMask = mCell - 1;
  const hiWanted = order > 0 && wanted ? wanted[order] : null;

  for (let j = 0; j < h; j++) {
    const Y = (MAP_H / 2 - (j + 0.5) * sy) * ky;
    const row = j * w;
    for (let i = 0; i < w; i++) {
      const X = (MAP_W / 2 - (i + 0.5) * sx) * kx;
      if (X * X + Y * Y > 1) { out[row + i] = 0; continue; }
      // Undo the map projection (the same maths as inverse() in sky.js, without the angles).
      const x = 2 * Math.SQRT2 * X, y = Math.SQRT2 * Y;
      const z = Math.sqrt(1 - (x * x) / 16 - (y * y) / 4);
      const a = z * x, b = 2 * (2 * z * z - 1), r = Math.sqrt(a * a + b * b);
      const chf = r > 1e-12 ? b / r : 1, shf = r > 1e-12 ? a / r : 0;
      const sinLat = z * y, cosLat = Math.sqrt(1 - sinLat * sinLat);
      const x2 = cosLat * (chf * chf - shf * shf), y2 = cosLat * 2 * shf * chf;
      const x1 = x2 * ct - sinLat * st, z1 = x2 * st + sinLat * ct;

      const c = cell(z1 > 1 ? 1 : z1 < -1 ? -1 : z1, Math.atan2(y2, x1) + rotRad);
      const face = c >>> 28, fx = c & TOP, fy = (c >> BITS) & TOP;

      // Use the sharpest loaded tile, from the ideal order down, then the whole-sky preview.
      let v = -1;
      for (let k = order; k > 0; k--) {
        const s = BITS - k;
        const n = (face << (2 * k)) | Z[(fx >> s) | ((fy >> s) << 5)];
        if (k === order && hiWanted) hiWanted[n] = 1;
        const t = tiles[k][n];
        if (t) {
          // Inside a tile picture the HEALPix x axis runs down the rows and y along the columns.
          v = t[(((fx >> (s - 9)) & 511) << 9) | ((fy >> (s - 9)) & 511)];
          break;
        }
      }
      if (v < 0) {
        const n = (face << 6) | Z[(fx >> (BITS - 3)) | ((fy >> (BITS - 3)) << 5)];
        const top = ((n / PREVIEW_COLS) | 0) * mCell + ((fx >> mShift) & mMask);
        v = mData[top * mW + (n % PREVIEW_COLS) * mCell + ((fy >> mShift) & mMask)];
      }
      out[row + i] = lut ? lut[v] : v;
    }
  }
  return order;
}
