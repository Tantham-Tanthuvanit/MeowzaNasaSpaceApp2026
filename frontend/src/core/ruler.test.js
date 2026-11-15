import { describe, expect, it } from 'vitest';
import {
  pixelToSky,
  calculateMeasurement,
  calculateProperMotion,
  getScaleBar,
} from './ruler';
import { skyToPixel } from './sky';

describe('ruler module', () => {
  it('pixelToSky and skyToPixel roundtrip accurately', () => {
    const ra0 = 133.795129;
    const dec0 = -7.245147;
    const fov = 5.0;

    // Center pixel (128, 128) must map to center coordinates
    const centerSky = pixelToSky(128, 128, ra0, dec0, fov);
    expect(centerSky.ra).toBeCloseTo(ra0, 4);
    expect(centerSky.dec).toBeCloseTo(dec0, 4);

    // Roundtrip test for arbitrary pixel
    const testX = 180;
    const testY = 75;
    const sky = pixelToSky(testX, testY, ra0, dec0, fov);
    const [backX, backY] = skyToPixel(sky.ra, sky.dec, ra0, dec0, fov);
    expect(backX).toBeCloseTo(testX, 3);
    expect(backY).toBeCloseTo(testY, 3);
  });

  it('calculateMeasurement computes distance and position angle correctly', () => {
    const ra0 = 133.795129;
    const dec0 = -7.245147;
    const fov = 5.0; // 5 arcmin = 300 arcsec across 256 px -> ~1.171875 arcsec/px

    // Point 1 at center, Point 2 100 px directly North (up in y, so y2 = 28)
    const p1 = { x: 128, y: 128 };
    const p2North = { x: 128, y: 28 };

    const measNorth = calculateMeasurement(p1, p2North, ra0, dec0, fov);
    expect(measNorth.distancePx).toBe(100);
    expect(measNorth.distanceArcsec).toBeCloseTo(117.19, 1);
    expect(measNorth.positionAngleDeg).toBeCloseTo(0, 1); // 0 deg is North
    expect(measNorth.compassDir).toBe('N');

    // Point 2 100 px directly East (left in x, so x2 = 28)
    const p2East = { x: 28, y: 128 };
    const measEast = calculateMeasurement(p1, p2East, ra0, dec0, fov);
    expect(measEast.distancePx).toBe(100);
    expect(measEast.positionAngleDeg).toBeCloseTo(90, 1); // 90 deg is East
    expect(measEast.compassDir).toBe('E');

    // Point 2 100 px directly South (down in y, so y2 = 228)
    const p2South = { x: 128, y: 228 };
    const measSouth = calculateMeasurement(p1, p2South, ra0, dec0, fov);
    expect(measSouth.positionAngleDeg).toBeCloseTo(180, 1); // 180 deg is South
    expect(measSouth.compassDir).toBe('S');

    // Point 2 100 px directly West (right in x, so x2 = 228)
    const p2West = { x: 228, y: 128 };
    const measWest = calculateMeasurement(p1, p2West, ra0, dec0, fov);
    expect(measWest.positionAngleDeg).toBeCloseTo(270, 1); // 270 deg is West
    expect(measWest.compassDir).toBe('W');
  });

  it('calculateProperMotion computes velocity across epoch time difference', () => {
    // A fast brown dwarf moving 8.1 arcsec over 365.25 days -> ~8.1 arcsec/yr (8100 mas/yr)
    const motion = calculateProperMotion(8.1, 365.25);
    expect(motion).not.toBeNull();
    expect(motion.speedArcsecYr).toBeCloseTo(8.1, 2);
    expect(motion.speedMasYr).toBe(8100);

    // Negative or zero days returns null
    expect(calculateProperMotion(5, 0)).toBeNull();
  });

  it('getScaleBar produces reasonable widths across various FOVs', () => {
    // 5 arcmin default FOV -> 1 arcmin (60 arcsec) scale bar
    const bar5 = getScaleBar(5.0);
    expect(bar5.arcsec).toBe(60);
    expect(bar5.pxWidth).toBeGreaterThanOrEqual(40);
    expect(bar5.pxWidth).toBeLessThanOrEqual(80);
    expect(bar5.label).toContain('1′');

    // 1 arcmin zoomed FOV
    const bar1 = getScaleBar(1.0);
    expect(bar1.pxWidth).toBeGreaterThanOrEqual(30);
    expect(bar1.pxWidth).toBeLessThanOrEqual(80);

    // 15 arcmin wide FOV
    const bar15 = getScaleBar(15.0);
    expect(bar15.pxWidth).toBeGreaterThanOrEqual(30);
    expect(bar15.pxWidth).toBeLessThanOrEqual(80);
  });
});
