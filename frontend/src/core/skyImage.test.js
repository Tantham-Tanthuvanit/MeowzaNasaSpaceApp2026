import { describe, it, expect } from 'vitest';
import { inverse, MAP_W, MAP_H } from './sky';
import { nestedIndex, renderSky, orderFor, makeLut, PREVIEW_COLS, PREVIEW_TILES } from './skyImage';

// Reference values from astropy_healpix (HEALPix(nside=2**order, order='nested').lonlat_to_healpix).
const POINTS = [[0.3, 0.1], [45.3, 0.2], [133.795129, -7.245147], [217.429167, -62.679444], [10, 89], [200, -89.5], [359.9, 41.9], [90, 41.81], [266.4, -28.94], [315, 60], [44.9, -45], [180, 0.01], [271, 75], [123.4, -80]];
const EXPECTED = {
  0: [4, 5, 9, 10, 0, 10, 3, 5, 7, 3, 8, 6, 3, 9],
  3: [282, 362, 639, 649, 63, 640, 213, 383, 450, 243, 527, 432, 251, 578],
  9: [1157804, 1485487, 2617960, 2661863, 262076, 2621473, 873815, 1572863, 1845129, 996339, 2162261, 1769472, 1031164, 2368608],
  12: [74099503, 95071202, 167549467, 170359233, 16772908, 167774281, 55924175, 100663295, 118088307, 63765747, 138384741, 113246208, 65994498, 151590962],
};

describe('nestedIndex', () => {
  it('matches astropy_healpix', () => {
    for (const [order, want] of Object.entries(EXPECTED)) {
      expect(POINTS.map(([ra, dec]) => nestedIndex(ra, dec, +order))).toEqual(want);
    }
  });
});

// A fake preview, 64 px per order-3 tile, whose brightness is fill(tile, row, col).
function fakePreview(fill) {
  const width = PREVIEW_COLS * 64, rows = Math.ceil(PREVIEW_TILES / PREVIEW_COLS) * 64;
  const data = new Uint8Array(width * rows);
  for (let n = 0; n < PREVIEW_TILES; n++) {
    for (let r = 0; r < 64; r++) for (let c = 0; c < 64; c++) {
      data[(((n / PREVIEW_COLS) | 0) * 64 + r) * width + (n % PREVIEW_COLS) * 64 + c] = fill(n, r, c);
    }
  }
  return { data, width, cell: 64 };
}
const identity = Uint32Array.from({ length: 256 }, (_, v) => v + 1); // 0 is kept for "off the sky"

// Share of map pixels where the drawn value equals expected(ra, dec), with inverse() as the truth.
function agreement(view, mip, expected) {
  const w = 328, h = 156, out = new Uint32Array(w * h);
  renderSky(out, w, h, view, { mips: [mip], tiles: {}, lut: identity }, null);
  let same = 0, total = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const spot = inverse(((i + 0.5) * MAP_W) / w, ((j + 0.5) * MAP_H) / h, view);
    const got = out[j * w + i];
    if (!spot) { expect(got).toBe(0); continue; }
    total++;
    if (got === expected(spot[0], spot[1]) + 1) same++;
  }
  expect(total).toBeGreaterThan(1000);
  return same / total;
}

describe('renderSky', () => {
  const views = [{ rot: 180, tilt: 0, zoom: 1 }, { rot: 133.8, tilt: -7.2, zoom: 1 }, { rot: 20, tilt: 65, zoom: 2.5 }, { rot: 300, tilt: -80, zoom: 6 }];

  it('draws each map pixel from the tile that inverse() says is there', () => {
    const mip = fakePreview((n) => (n * 7) % 255);
    for (const view of views) {
      expect(agreement(view, mip, (ra, dec) => (nestedIndex(ra, dec, 3) * 7) % 255)).toBeGreaterThan(0.995);
    }
  });

  it('reads tile pictures with HEALPix x down the rows and y along the columns', () => {
    // Order 9 splits each order-3 tile 64 x 64; x sits on the even bits of the nested number.
    const xy = (ra, dec) => {
      const sub = nestedIndex(ra, dec, 9) % 4096;
      let x = 0, y = 0;
      for (let b = 0; b < 6; b++) { x |= ((sub >> (2 * b)) & 1) << b; y |= ((sub >> (2 * b + 1)) & 1) << b; }
      return [x, y];
    };
    const view = { rot: 266, tilt: -29, zoom: 6 };
    expect(agreement(view, fakePreview((n, r) => r), (ra, dec) => xy(ra, dec)[0])).toBeGreaterThan(0.97);
    expect(agreement(view, fakePreview((n, r, c) => c), (ra, dec) => xy(ra, dec)[1])).toBeGreaterThan(0.97);
  });

  it('uses a loaded sharp tile, asks for the ones it wants, and falls back to the preview', () => {
    const view = { rot: 0, tilt: 0, zoom: 6 }, w = MAP_W, h = 20;
    expect(orderFor(view.zoom, w)).toBe(2);
    const centre = nestedIndex(0, 0, 2);
    const wanted = { 2: new Uint8Array(192) };
    const src = { mips: [fakePreview(() => 10)], tiles: { 1: [], 2: [] }, lut: identity };
    src.tiles[2][centre] = new Uint8Array(512 * 512).fill(200);
    const out = new Uint32Array(w * h);
    expect(renderSky(out, w, h, view, src, wanted)).toBe(2);
    expect(wanted[2][centre]).toBe(1);
    const seen = new Set(out);
    expect(seen.has(201)).toBe(true); // the sharp tile
    expect(seen.has(11)).toBe(true); // preview where no sharp tile is loaded
  });
});

describe('renderSky at full zoom', () => {
  it('draws the sharpest tiles the right way round', () => {
    // A 410 px test canvas at zoom 200 shows the sky at the same scale as the full map at zoom 50.
    const view = { rot: 133.795129, tilt: -7.245147, zoom: 200 }, w = 410, h = 195;
    const src = { mips: [fakePreview(() => 0)], tiles: { 1: [], 2: [], 3: [], 4: [], 5: [] }, lut: identity };
    const n = nestedIndex(view.rot, view.tilt, 5);
    const tile = new Uint8Array(512 * 512);
    for (let r = 0; r < 512; r++) tile.fill(1 + (r >> 2), r * 512, (r + 1) * 512); // 1 to 128 down the rows
    src.tiles[5][n] = tile;
    const wanted = { 5: new Uint8Array(12 * 4 ** 5) };
    const out = new Uint32Array(w * h);
    expect(renderSky(out, w, h, view, src, wanted)).toBe(5);
    expect(wanted[5][n]).toBe(1);
    let same = 0, total = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const spot = inverse(((i + 0.5) * MAP_W) / w, ((j + 0.5) * MAP_H) / h, view);
      if (nestedIndex(spot[0], spot[1], 5) !== n) continue;
      const sub = nestedIndex(spot[0], spot[1], 14) % 4 ** 9;
      let x = 0;
      for (let b = 0; b < 9; b++) x += (Math.floor(sub / 4 ** b) % 2) << b;
      total++;
      if (out[j * w + i] === 2 + (x >> 2)) same++;
    }
    expect(total).toBeGreaterThan(5000);
    expect(same / total).toBeGreaterThan(0.97);
  });
});

describe('orderFor', () => {
  it('needs only the preview when zoomed out, sharper tiles when zoomed in', () => {
    expect(orderFor(1, MAP_W)).toBe(0);
    expect(orderFor(3, MAP_W)).toBe(1);
    expect(orderFor(6, MAP_W)).toBe(2);
    expect(orderFor(6, MAP_W / 2)).toBe(1);
    expect(orderFor(50, MAP_W)).toBe(5);
    expect(orderFor(5000, MAP_W)).toBe(5);
  });
});

describe('makeLut', () => {
  it('goes from the map navy to near white, getting brighter all the way', () => {
    const lut = makeLut();
    expect(lut[0] >>> 0).toBe(0xff30120b);
    for (let v = 1; v < 256; v++) expect(lut[v] & 255).toBeGreaterThanOrEqual(lut[v - 1] & 255);
    expect(lut[255] & 255).toBe(248);
  });
});
