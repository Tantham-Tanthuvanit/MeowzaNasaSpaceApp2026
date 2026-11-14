import { describe, it, expect } from 'vitest';
import { parseRa, parseDec, fmtRa, fmtDec, project, inverse, skyToPixel, gridStep, gridLines, MAX_ZOOM, MAP_W, MAP_H } from './sky';

describe('gridLines', () => {
  const onScreen = (d) => (d.match(/[\d.-]+ [\d.-]+/g) || []).some((p) => {
    const [x, y] = p.split(' ').map(Number);
    return x >= 0 && x <= MAP_W && y >= 0 && y <= MAP_H;
  });
  it('draws the whole-sky grid every 30 degrees when zoomed out', () => {
    expect(gridStep(1)).toBe(30);
    expect(gridLines({ rot: 0, tilt: 0, zoom: 1 })).toHaveLength(5 + 12);
  });
  it('gets finer with zoom and always leaves lines in view', () => {
    expect([3, 10, 20, 50, 100, MAX_ZOOM].map(gridStep)).toEqual([15, 5, 2, 1, 0.5, 0.25]);
    for (const zoom of [1, 2.4, 3, 6, 10, 16, 30, 50, 69, 100, 139, MAX_ZOOM]) {
      for (const [rot, tilt] of [[0, 0], [133.8, -7.2], [359.5, 44], [217.4, -62.7], [10, 89.5], [200, -90]]) {
        const lines = gridLines({ rot, tilt, zoom });
        expect(lines.length).toBeLessThan(120);
        expect(lines.filter(onScreen).length).toBeGreaterThanOrEqual(zoom === 1 ? 17 : 3);
      }
    }
  });
});

describe('parseRa', () => {
  it('reads hours, minutes, seconds', () => {
    expect(parseRa('08h55m10.831s')).toBeCloseTo(133.795129, 5);
    expect(parseRa('17h57m48.5s')).toBeCloseTo(269.452083, 5);
    expect(parseRa('08 55 10.831')).toBeCloseTo(133.795129, 5);
  });
  it('reads decimal degrees', () => {
    expect(parseRa('133.795')).toBe(133.795);
  });
  it('rejects bad input', () => {
    for (const bad of ['', 'hello', '24h00m00s', '08h60m00s', '360', '1 2 3 4']) {
      expect(parseRa(bad)).toBeNull();
    }
  });
});

describe('parseDec', () => {
  it('reads degrees, minutes, seconds with a sign', () => {
    expect(parseDec('-7d14m42.53s')).toBeCloseTo(-7.245147, 5);
    expect(parseDec('+66d45m18s')).toBeCloseTo(66.755, 5);
    expect(parseDec('−7° 14′ 42.5″')).toBeCloseTo(-7.245139, 5);
  });
  it('keeps the sign when the degrees are zero', () => {
    expect(parseDec('-0d30m00s')).toBeCloseTo(-0.5, 9);
  });
  it('reads decimal degrees', () => {
    expect(parseDec('-56.78')).toBe(-56.78);
  });
  it('rejects bad input', () => {
    for (const bad of ['', 'north', '91', '-90d00m01s', '10d60m00s']) {
      expect(parseDec(bad)).toBeNull();
    }
  });
});

describe('formatting', () => {
  it('writes compact text that parses back to the same place', () => {
    for (const [ra, dec] of [[269.45, 4.69], [331.04, -56.78], [133.8, -7.25], [76.96, 30.4], [248.17, 66.75]]) {
      expect(parseRa(fmtRa(ra, true))).toBeCloseTo(ra, 3);
      expect(parseDec(fmtDec(dec, true))).toBeCloseTo(dec, 3);
    }
  });
  it('writes the readable forms', () => {
    expect(fmtRa(133.795129)).toBe('08h 55m 10.8s');
    expect(fmtRa(133.795129, true)).toBe('08h55m10.8s');
    expect(fmtDec(-7.245147)).toBe('−7° 14′ 42.5″');
    expect(fmtDec(-7.245147, true)).toBe('-7d14m42.5s');
  });
  it('carries rounded-up seconds instead of printing 60', () => {
    expect(fmtRa(359.9999999)).toBe('00h 00m 00.0s');
    expect(fmtDec(9.9999999)).toBe('+10° 00′ 00.0″');
  });
});

describe('map projection', () => {
  it('puts the view centre in the middle of the map', () => {
    const [x, y] = project(120, 30, { rot: 120, tilt: 30, zoom: 2 });
    expect(x).toBeCloseTo(MAP_W / 2, 6);
    expect(y).toBeCloseTo(MAP_H / 2, 6);
  });
  it('draws east to the left and north up', () => {
    const view = { rot: 0, tilt: 0, zoom: 1 };
    expect(project(30, 0, view)[0]).toBeLessThan(MAP_W / 2);
    expect(project(0, 30, view)[1]).toBeLessThan(MAP_H / 2);
  });
  it('inverse undoes project for any view', () => {
    const views = [{ rot: 0, tilt: 0, zoom: 1 }, { rot: 200, tilt: -35, zoom: 3 }, { rot: 75, tilt: 60, zoom: 1.5 }];
    const spots = [[269.45, 4.69], [331.04, -56.78], [133.8, -7.25], [76.96, 30.4], [248.17, 66.75]];
    for (const view of views) {
      for (const [ra, dec] of spots) {
        const [x, y] = project(ra, dec, view);
        const back = inverse(x, y, view);
        expect(back[0]).toBeCloseTo(ra, 6);
        expect(back[1]).toBeCloseTo(dec, 6);
      }
    }
  });
  it('returns null outside the sky oval', () => {
    expect(inverse(5, 5, { rot: 0, tilt: 0, zoom: 1 })).toBeNull();
  });
});

describe('skyToPixel', () => {
  it('puts the centre of the picture at (128, 128)', () => {
    expect(skyToPixel(133.795129, -7.245147, 133.795129, -7.245147)).toEqual([128, 128]);
  });
  it('matches the backend: /api/pixel-to-radec turns (100, 60) into this position', () => {
    const [x, y] = skyToPixel(133.80431694322306, -7.223011583333333, 133.795129, -7.245147);
    expect(x).toBeCloseTo(100, 4);
    expect(y).toBeCloseTo(60, 4);
  });
  it('works across RA 0', () => {
    expect(skyToPixel(0.01, 0, 359.99, 0)[0]).toBeCloseTo(128 - 0.02 * 3072, 6);
  });
});
