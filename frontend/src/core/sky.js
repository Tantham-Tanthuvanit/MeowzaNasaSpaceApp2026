// Sky maths: all-sky Mollweide-style map projection and RA/Dec text handling.
// Map coordinates are in a fixed 1640 x 780 space; the SVG viewBox scales it to any screen.

export const MAP_W = 1640;
export const MAP_H = 780;
const CX = 820, CY = 390, RX = 776, RY = 386;
export const MAP_RX = RX;
export const MAP_RY = RY;
const RAD = Math.PI / 180;

export const wrap360 = (v) => ((v % 360) + 360) % 360;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Rotate the sky so (rot, tilt) sits at the map centre. Returns [lon, lat] in radians.
function rotate(ra, dec, rot, tilt) {
  const a = (ra - rot) * RAD, d = dec * RAD, t = tilt * RAD;
  const x = Math.cos(d) * Math.cos(a), y = Math.cos(d) * Math.sin(a), z = Math.sin(d);
  const x2 = x * Math.cos(t) + z * Math.sin(t);
  const z2 = -x * Math.sin(t) + z * Math.cos(t);
  return [Math.atan2(y, x2), Math.asin(clamp(z2, -1, 1))];
}

// RA/Dec in degrees -> [x, y, lon] on the map. East is to the left, as on the real sky.
export function project(ra, dec, { rot, tilt, zoom }) {
  const [l, p] = rotate(ra, dec, rot, tilt);
  const d = Math.sqrt(1 + Math.cos(p) * Math.cos(l / 2));
  const X = (Math.cos(p) * Math.sin(l / 2)) / d;
  const Y = Math.sin(p) / d;
  return [CX - X * RX * zoom, CY - Y * RY * zoom, l];
}

// Map point -> [ra, dec] in degrees, or null when the point is off the sky.
export function inverse(px, py, { rot, tilt, zoom }) {
  const X = (CX - px) / (RX * zoom), Y = (CY - py) / (RY * zoom);
  if (X * X + Y * Y > 1) return null;
  const x = 2 * Math.SQRT2 * X, y = Math.SQRT2 * Y;
  const z = Math.sqrt(1 - (x / 4) * (x / 4) - (y / 2) * (y / 2));
  const lon = 2 * Math.atan2(z * x, 2 * (2 * z * z - 1));
  const lat = Math.asin(clamp(z * y, -1, 1));
  const x2 = Math.cos(lat) * Math.cos(lon), y2 = Math.cos(lat) * Math.sin(lon), z2 = Math.sin(lat);
  const t = tilt * RAD;
  const x1 = x2 * Math.cos(t) - z2 * Math.sin(t), z1 = x2 * Math.sin(t) + z2 * Math.cos(t);
  return [wrap360(Math.atan2(y2, x1) / RAD + rot), Math.asin(clamp(z1, -1, 1)) / RAD];
}

// SVG path through projected points, lifting the pen where a line wraps round the back.
export function pathFrom(points) {
  let out = '', prev = null;
  for (const q of points) {
    const jump = prev === null || Math.abs(q[2] - prev[2]) > Math.PI / 2;
    out += (jump ? 'M' : 'L') + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ' ';
    prev = q;
  }
  return out.trim();
}

// Where a sky position lands on a 256 x 256 picture centred on (ra0, dec0) that shows `fov`
// arcminutes. North is up and east is left. The inverse of the backend's /api/pixel-to-radec.
export function skyToPixel(ra, dec, ra0, dec0, fov = 5) {
  const perDeg = 256 / (fov / 60);
  const dRa = ((ra - ra0 + 540) % 360) - 180;
  return [128 - dRa * Math.cos(dec0 * RAD) * perDeg, 128 - (dec - dec0) * perDeg];
}

const nums = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);

// "08h55m10.8s", "08 55 10.8" or decimal degrees -> degrees, or null if not a valid RA.
export function parseRa(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return +s < 360 ? +s : null;
  const n = nums(s);
  if (!n.length || n.length > 3) return null;
  const [h, m = 0, sec = 0] = n;
  if (h >= 24 || m >= 60 || sec >= 60) return null;
  return (h + m / 60 + sec / 3600) * 15;
}

// "-7d14m42.5s", "−7° 14′ 42.5″" or decimal degrees -> degrees, or null if not a valid Dec.
export function parseDec(input) {
  const s = String(input ?? '').trim().replace(/−/g, '-');
  if (!s) return null;
  const neg = s.charAt(0) === '-';
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) {
    const v = Math.abs(+s);
    return v <= 90 ? (neg ? -v : v) : null;
  }
  const n = nums(s);
  if (!n.length || n.length > 3) return null;
  const [d, m = 0, sec = 0] = n;
  if (m >= 60 || sec >= 60) return null;
  const v = d + m / 60 + sec / 3600;
  if (v > 90) return null;
  return neg ? -v : v;
}

const pad2 = (n) => String(n).padStart(2, '0');

// Split a non-negative value in "units" into [whole, minutes, seconds], seconds rounded to 0.1.
function sexagesimal(value) {
  const tenths = Math.round(value * 36000);
  const whole = Math.floor(tenths / 36000);
  const m = Math.floor((tenths - whole * 36000) / 600);
  const sec = (tenths - whole * 36000 - m * 600) / 10;
  return [whole, m, sec.toFixed(1).padStart(4, '0')];
}

// compact: "08h55m10.8s" (for inputs and URLs). Otherwise "08h 55m 10.8s" (for reading).
export function fmtRa(ra, compact = false) {
  const [h, m, s] = sexagesimal(wrap360(ra) / 15);
  const sep = compact ? '' : ' ';
  return `${pad2(h % 24)}h${sep}${pad2(m)}m${sep}${s}s`;
}

// compact: "-7d14m42.5s". Otherwise "−7° 14′ 42.5″".
export function fmtDec(dec, compact = false) {
  const [d, m, s] = sexagesimal(Math.abs(dec));
  if (compact) return `${dec < 0 ? '-' : '+'}${d}d${pad2(m)}m${s}s`;
  return `${dec < 0 ? '−' : '+'}${d}° ${pad2(m)}′ ${s}″`;
}
