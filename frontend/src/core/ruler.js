// ruler.js — Astronomical measurement and distance calculations for the sky viewer.
// Provides angular separations, position angles, coordinate projections,
// epoch-to-epoch motion rates, and dynamic astronomical scale bars.

import { fmtRa, fmtDec } from './sky';

const RAD = Math.PI / 180;
const COMPASS_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/**
 * Inverts screen pixels (0-256) back into celestial coordinates (RA, Dec)
 * on a patch centred at (ra0, dec0) with field of view `fov` arcminutes.
 */
export function pixelToSky(x, y, ra0, dec0, fov = 5.0) {
  const perDeg = 256 / (fov / 60);
  const cosDec = Math.max(Math.cos(dec0 * RAD), 1e-6);
  const dx = x - 128;
  const dy = y - 128;

  const dRa = -dx / (perDeg * cosDec);
  const dDec = -dy / perDeg;

  const ra = ((ra0 + dRa) % 360 + 360) % 360;
  const dec = Math.max(-90, Math.min(90, dec0 + dDec));

  return { ra, dec };
}

/**
 * Calculates complete astronomical measurement between two points (p1, p2)
 * on a 256x256 sky patch.
 */
export function calculateMeasurement(p1, p2, ra0, dec0, fov = 5.0) {
  if (!p1 || !p2) return null;

  const dxPx = p2.x - p1.x;
  const dyPx = p2.y - p1.y;
  const distancePx = Math.hypot(dxPx, dyPx);

  const arcsecPerPx = (fov * 60) / 256;
  const distanceArcsec = distancePx * arcsecPerPx;
  const distanceArcmin = distanceArcsec / 60;
  const distanceMas = distanceArcsec * 1000;

  // In astronomy: North is UP (-y), East is LEFT (-x)
  const dxAstro = -(p2.x - p1.x); // positive East
  const dyAstro = -(p2.y - p1.y); // positive North
  let angleRad = Math.atan2(dxAstro, dyAstro);
  let angleDeg = (angleRad * (180 / Math.PI) + 360) % 360;

  const compassIdx = Math.round(angleDeg / 22.5) % 16;
  const compassDir = COMPASS_POINTS[compassIdx];

  // Endpoints in celestial coordinates
  const c1 = pixelToSky(p1.x, p1.y, ra0, dec0, fov);
  const c2 = pixelToSky(p2.x, p2.y, ra0, dec0, fov);

  const deltaRaArcsec = dxAstro * arcsecPerPx;
  const deltaDecArcsec = dyAstro * arcsecPerPx;

  return {
    p1: { x: Number(p1.x.toFixed(1)), y: Number(p1.y.toFixed(1)) },
    p2: { x: Number(p2.x.toFixed(1)), y: Number(p2.y.toFixed(1)) },
    distancePx: Number(distancePx.toFixed(1)),
    distanceArcsec: Number(distanceArcsec.toFixed(2)),
    distanceArcmin: Number(distanceArcmin.toFixed(3)),
    distanceMas: Math.round(distanceMas),
    positionAngleDeg: Number(angleDeg.toFixed(1)),
    compassDir,
    coordA: {
      ra: c1.ra,
      dec: c1.dec,
      raFormatted: fmtRa(c1.ra),
      decFormatted: fmtDec(c1.dec),
    },
    coordB: {
      ra: c2.ra,
      dec: c2.dec,
      raFormatted: fmtRa(c2.ra),
      decFormatted: fmtDec(c2.dec),
    },
    deltaRaArcsec: Number(deltaRaArcsec.toFixed(2)),
    deltaDecArcsec: Number(deltaDecArcsec.toFixed(2)),
  };
}

/**
 * Computes apparent proper motion / speed given angular distance in arcseconds
 * and the elapsed time between visits in days.
 */
export function calculateProperMotion(distanceArcsec, deltaDays) {
  if (!deltaDays || deltaDays <= 0) return null;
  const deltaYears = deltaDays / 365.25;
  const speedArcsecYr = distanceArcsec / deltaYears;
  const speedMasYr = speedArcsecYr * 1000;
  return {
    deltaDays: Number(deltaDays.toFixed(1)),
    deltaYears: Number(deltaYears.toFixed(3)),
    speedArcsecYr: Number(speedArcsecYr.toFixed(2)),
    speedMasYr: Math.round(speedMasYr),
  };
}

// Candidate scale intervals in arcseconds
const SCALE_CANDIDATES = [
  1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 600, 900, 1200, 1800,
];

/**
 * Calculates a clean astronomical scale bar for the current FOV (arcminutes).
 * Returns pixel width (clamped around 40-80px), length in arcseconds/arcminutes, and label.
 */
export function getScaleBar(fov = 5.0) {
  const safeFov = Math.max(0.1, Math.min(120, fov));
  const totalArcsec = safeFov * 60;
  const pxPerArcsec = 256 / totalArcsec;

  // Find candidate that produces width closest to ~55 px
  let best = SCALE_CANDIDATES[0];
  let bestDiff = Infinity;

  for (const s of SCALE_CANDIDATES) {
    const px = s * pxPerArcsec;
    if (px < 30 || px > 100) continue;
    const diff = Math.abs(px - 55);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }

  // Fallback if none in range
  if (bestDiff === Infinity) {
    best = SCALE_CANDIDATES.reduce((prev, curr) =>
      Math.abs(curr * pxPerArcsec - 55) < Math.abs(prev * pxPerArcsec - 55) ? curr : prev
    );
  }

  const pxWidth = Math.max(20, Math.round(best * pxPerArcsec));
  let label = `${best}″`;
  if (best >= 60) {
    const mins = Math.floor(best / 60);
    const rem = best % 60;
    label = rem === 0 ? `${mins}′ (${best}″)` : `${mins}′ ${rem}″`;
  }

  return {
    arcsec: best,
    pxWidth,
    label,
  };
}
