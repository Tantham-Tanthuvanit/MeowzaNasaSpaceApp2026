// Spectral feature catalogue and analysis utilities for SPHEREx 102-channel spectra (0.75 - 5.00 µm).
// Provides identification and classification of absorption dips and emission lines.

export const SPECTRAL_FEATURES = [
  // Absorption features (molecular gases, ice mantles, and planetary/substellar atmospheres)
  {
    id: 'h2o_vap_1',
    name: 'H₂O Vapor (1.40 µm)',
    label: 'H₂O Vapor',
    type: 'absorption',
    wavelength_um: 1.40,
    detector: 2,
    desc: 'Water vapor absorption in cool stellar and substellar atmospheres.',
  },
  {
    id: 'ch4_overtone',
    name: 'CH₄ Methane Overtone (1.66 µm)',
    label: 'CH₄ Overtone',
    type: 'absorption',
    wavelength_um: 1.66,
    detector: 3,
    desc: 'Substellar methane overtone absorption band in cold brown dwarfs.',
  },
  {
    id: 'h2o_vap_2',
    name: 'H₂O Vapor (1.90 µm)',
    label: 'H₂O Vapor',
    type: 'absorption',
    wavelength_um: 1.90,
    detector: 3,
    desc: 'Atmospheric water absorption trough.',
  },
  {
    id: 'co_ch4',
    name: 'CO / CH₄ Bandhead (2.30 µm)',
    label: 'CO / CH₄',
    type: 'absorption',
    wavelength_um: 2.30,
    detector: 3,
    desc: 'Carbon monoxide first overtone and methane bandhead absorption.',
  },
  {
    id: 'h2o_ice',
    name: 'H₂O Ice Mantle (3.05 µm)',
    label: 'H₂O Ice',
    type: 'absorption',
    wavelength_um: 3.05,
    detector: 4,
    desc: 'Deep 3.05 µm water ice absorption on interstellar dust grains.',
  },
  {
    id: 'ch4_fund',
    name: 'CH₄ Fundamental (3.30 µm)',
    label: 'CH₄ Fund.',
    type: 'absorption',
    wavelength_um: 3.30,
    detector: 4,
    desc: 'Strong methane fundamental absorption in planetary and brown dwarf atmospheres.',
  },
  {
    id: 'co2_ice',
    name: 'CO₂ Ice (4.27 µm)',
    label: 'CO₂ Ice',
    type: 'absorption',
    wavelength_um: 4.27,
    detector: 5,
    desc: 'Solid-state carbon dioxide ice absorption on interstellar grain surfaces.',
  },
  {
    id: 'co_gas',
    name: 'CO Gas Band (4.67 µm)',
    label: 'CO Gas',
    type: 'absorption',
    wavelength_um: 4.67,
    detector: 6,
    desc: 'Fundamental carbon monoxide rovibrational gas absorption.',
  },

  // Emission features (ionized gas, shock waves, PAH dust, and recombination lines)
  {
    id: 'pa_alpha',
    name: 'H Pa-α Paschen-alpha (1.875 µm)',
    label: 'H Pa-α',
    type: 'emission',
    wavelength_um: 1.875,
    detector: 3,
    desc: 'Hydrogen recombination emission from warm ionized gas and stellar accretion.',
  },
  {
    id: 'h2_shock',
    name: 'H₂ Molecular (2.12 µm)',
    label: 'H₂ Line',
    type: 'emission',
    wavelength_um: 2.122,
    detector: 3,
    desc: '1-0 S(1) shock-excited molecular hydrogen emission in stellar outflows.',
  },
  {
    id: 'br_gamma',
    name: 'H Br-γ Brackett-gamma (2.166 µm)',
    label: 'H Br-γ',
    type: 'emission',
    wavelength_um: 2.166,
    detector: 3,
    desc: 'Hydrogen recombination line tracing active accretion and hot young stars.',
  },
  {
    id: 'pah_33',
    name: 'PAH Dust (3.30 µm)',
    label: 'PAH 3.3µm',
    type: 'emission',
    wavelength_um: 3.30,
    detector: 4,
    desc: 'Polycyclic aromatic hydrocarbon aromatic C-H stretching emission.',
  },
  {
    id: 'pah_34',
    name: 'PAH Dust (3.40 µm)',
    label: 'PAH 3.4µm',
    type: 'emission',
    wavelength_um: 3.40,
    detector: 4,
    desc: 'Aliphatic C-H dust grain emission from star-forming regions.',
  },
  {
    id: 'br_alpha',
    name: 'H Br-α Brackett-alpha (4.05 µm)',
    label: 'H Br-α',
    type: 'emission',
    wavelength_um: 4.052,
    detector: 5,
    desc: 'Infrared hydrogen recombination emission tracing accretion shocks and nebulae.',
  },
];

/**
 * Maps a wavelength in the 0.75 - 5.00 µm range to a false-color hex representation.
 * Transitioning across the 6 SPHEREx detector bands from deep indigo/blue through cyan,
 * emerald green, golden amber, orange, to deep infrared crimson.
 */
export function wavelengthToColor(um) {
  const t = Math.max(0, Math.min(1, (um - 0.75) / (5.0 - 0.75)));
  if (t < 0.1) return '#3D5BE0'; // Band 1
  if (t < 0.25) return '#1FA2B8'; // Band 2
  if (t < 0.45) return '#2FA85A'; // Band 3
  if (t < 0.75) return '#E2B41F'; // Band 4
  if (t < 0.88) return '#EE7F22'; // Band 5
  return '#D2362F'; // Band 6
}

/**
 * Finds the closest known spectral feature within `maxDiff` µm.
 */
export function findNearestFeature(um, maxDiff = 0.08) {
  if (typeof um !== 'number') return null;
  let closest = null;
  let minDiff = Infinity;
  for (const feat of SPECTRAL_FEATURES) {
    const diff = Math.abs(feat.wavelength_um - um);
    if (diff < minDiff && diff <= maxDiff) {
      minDiff = diff;
      closest = feat;
    }
  }
  return closest;
}

/**
 * Calculates a running median baseline (continuum) for valid flux points.
 */
export function calculateContinuum(points, windowSize = 7) {
  if (!points || !points.length) return [];
  const half = Math.floor(windowSize / 2);
  return points.map((p, idx) => {
    const start = Math.max(0, idx - half);
    const end = Math.min(points.length, idx + half + 1);
    const slice = points.slice(start, end).map((pt) => pt.flux_mjy_sr).sort((a, b) => a - b);
    const mid = Math.floor(slice.length / 2);
    const median = slice.length % 2 !== 0 ? slice[mid] : (slice[mid - 1] + slice[mid]) / 2;
    return {
      wavelength_um: p.wavelength_um,
      continuum_flux: median,
    };
  });
}

/**
 * Analyzes spectral points to identify notable absorption troughs and emission peaks.
 */
export function detectSpectralFeatures(points) {
  if (!points || points.length < 5) return { absorption: [], emission: [] };
  const continuum = calculateContinuum(points, 7);
  const absorption = [];
  const emission = [];

  points.forEach((p, idx) => {
    const cont = continuum[idx]?.continuum_flux;
    if (cont == null || Math.abs(cont) < 1e-6) return;
    const ratio = (p.flux_mjy_sr - cont) / Math.max(Math.abs(cont), 0.01);
    const matched = findNearestFeature(p.wavelength_um, 0.06);

    if (ratio < -0.12 || (matched?.type === 'absorption' && ratio < -0.05)) {
      absorption.push({
        ...p,
        delta_pct: Math.round(ratio * 100),
        matchedFeature: matched?.type === 'absorption' ? matched : null,
      });
    } else if (ratio > 0.12 || (matched?.type === 'emission' && ratio > 0.05)) {
      emission.push({
        ...p,
        delta_pct: Math.round(ratio * 100),
        matchedFeature: matched?.type === 'emission' ? matched : null,
      });
    }
  });

  return { absorption, emission };
}
