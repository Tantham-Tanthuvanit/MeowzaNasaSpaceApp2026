/**
 * mockData.js — Fallback & Development Mock Data for SPHEREx Sky Viewer.
 *
 * Provides instant, realistic datasets matching the backend API contract so the
 * frontend can be styled, tested, and iterated on directly with Wut's Figma designs
 * even when the backend is offline or during component development.
 */

// 1. Benchmark Challenge Presets
export const MOCK_PRESETS = [
  {
    id: "wise_0855",
    name: "WISE 0855",
    category: "Fast-Moving Brown Dwarf",
    ra: "08h55m10.831s",
    dec: "-07d14m42.53s",
    ra_deg: 133.795129,
    dec_deg: -7.245147,
    description: "Sub-brown dwarf just 7.4 light-years away exhibiting exceptional proper motion across SPHEREx epochs.",
    expected_phenomenon: "Rapid spatial shift between epochs (proper motion dipole in difference imaging)."
  },
  {
    id: "barnards_star",
    name: "Barnard's Star",
    category: "High Proper-Motion Star",
    ra: "17h57m48.498s",
    dec: "+04d41m36.20s",
    ra_deg: 269.452075,
    dec_deg: 4.693389,
    description: "Red dwarf star with the highest known proper motion of any star relative to our Solar System (10.3 arcsec/yr).",
    expected_phenomenon: "Noticeable position drift across six-month mission epochs."
  },
  {
    id: "epsilon_indi_b",
    name: "Epsilon Indi B",
    category: "Brown Dwarf Binary Pair",
    ra: "22h04m10.50s",
    dec: "-56d46m58.0s",
    ra_deg: 331.043750,
    dec_deg: -56.782778,
    description: "Nearby binary system consisting of two methane-rich brown dwarfs orbiting Epsilon Indi A.",
    expected_phenomenon: "Co-moving brown dwarf signatures with distinct methane absorption in near-IR bands."
  },
  {
    id: "rw_aurigae",
    name: "RW Aurigae",
    category: "Variable Star",
    ra: "05h07m49.57s",
    dec: "+30d24m05.10s",
    ra_deg: 76.956542,
    dec_deg: 30.401417,
    description: "Classical T Tauri binary variable system undergoing dramatic, multi-epoch dimming events caused by circumstellar dust disks.",
    expected_phenomenon: "Large flux variation and strong residual in difference images without spatial shift."
  },
  {
    id: "r_draconis",
    name: "R Draconis",
    category: "Mira Variable Star",
    ra: "16h32m40.23s",
    dec: "+66d45m17.90s",
    ra_deg: 248.167625,
    dec_deg: 66.754972,
    description: "Pulsating red giant star with strong cyclical variations in brightness and heavy infrared excess.",
    expected_phenomenon: "Periodic brightness change highlighting variability over 6-month SPHEREx cadences."
  }
];

// 2. SPHEREx 6 Detector Arrays
export const MOCK_DETECTOR_ARRAYS = {
  array_1: { name: "Array 1 (Near-IR 1)", range_um: [0.75, 1.11], bands: 17, index: 1 },
  array_2: { name: "Array 2 (Near-IR 2)", range_um: [1.11, 1.64], bands: 17, index: 2 },
  array_3: { name: "Array 3 (Near-IR 3)", range_um: [1.64, 2.42], bands: 17, index: 3 },
  array_4: { name: "Array 4 (Mid-IR 1)",  range_um: [2.42, 3.82], bands: 17, index: 4 },
  array_5: { name: "Array 5 (Mid-IR 2)",  range_um: [3.82, 4.42], bands: 17, index: 5 },
  array_6: { name: "Array 6 (Mid-IR 3)",  range_um: [4.42, 5.00], bands: 17, index: 6 },
};

// 3. Helper to generate synthetic 102-point spectrum
export function generateMockSpectrum(targetName = "WISE 0855") {
  const spectrum = [];
  const waves = [];
  const ranges = [
    [0.75, 1.11], [1.11, 1.64], [1.64, 2.42],
    [2.42, 3.82], [3.82, 4.42], [4.42, 5.00]
  ];

  let bandIdx = 1;
  ranges.forEach(([start, end], arrayIdx) => {
    const step = (end - start) / 16;
    for (let i = 0; i < 17; i++) {
      const w = parseFloat((start + i * step).toFixed(3));
      // Brown dwarf profile with methane & water dips
      let flux = 0.5 * Math.pow(w / 3.0, 2.2);
      if (Math.abs(w - 1.4) < 0.2) flux *= 0.4; // H2O
      if (Math.abs(w - 1.66) < 0.15) flux *= 0.5; // CH4
      if (Math.abs(w - 3.3) < 0.35) flux *= 0.3; // Deep CH4
      if (Math.abs(w - 4.6) < 0.25) flux *= 0.6; // CO
      flux = Math.max(0.12, parseFloat((flux + (Math.sin(i * 1.5) * 0.05)).toFixed(3)));

      spectrum.push({
        band_index: bandIdx++,
        wavelength_um: w,
        flux,
        detector_array: arrayIdx + 1
      });
    }
  });

  return spectrum;
}

// 4. Lightweight inline SVG Data URIs representing astronomical cutouts
function createMockStarSvg(targetOffset = { x: 0, y: 0 }, isDiff = false) {
  const bg = isDiff ? "#1e293b" : "#020617";
  const starFill = isDiff ? "#f59e0b" : "#38bdf8";
  const tx = 128 + targetOffset.x;
  const ty = 128 + targetOffset.y;

  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="${encodeURIComponent(bg)}"/>
    <!-- Background field stars -->
    <circle cx="45" cy="60" r="1.5" fill="%23cbd5e1" opacity="0.8"/>
    <circle cx="190" cy="40" r="2.0" fill="%2394a3b8" opacity="0.7"/>
    <circle cx="210" cy="180" r="2.5" fill="%23f1f5f9" opacity="0.9"/>
    <circle cx="70" cy="210" r="1.8" fill="%23cbd5e1" opacity="0.6"/>
    <circle cx="30" cy="150" r="1.2" fill="%2364748b" opacity="0.5"/>
    <circle cx="160" cy="220" r="2.2" fill="%23e2e8f0" opacity="0.8"/>
    <!-- Target celestial object -->
    ${isDiff 
      ? `<!-- Moving dipole signature -->
         <circle cx="${128}" cy="${128}" r="5" fill="%233b82f6" opacity="0.7"/>
         <circle cx="${tx}" cy="${ty}" r="5" fill="%23ef4444" opacity="0.85"/>
         <line x1="${128}" y1="${128}" x2="${tx}" y2="${ty}" stroke="%23fbbf24" stroke-width="1.5" stroke-dasharray="2,2"/>`
      : `<!-- Stellar PSF -->
         <circle cx="${tx}" cy="${ty}" r="12" fill="${encodeURIComponent(starFill)}" opacity="0.25"/>
         <circle cx="${tx}" cy="${ty}" r="6" fill="${encodeURIComponent(starFill)}" opacity="0.6"/>
         <circle cx="${tx}" cy="${ty}" r="2.5" fill="%23ffffff"/>`
    }
  </svg>`;
}

// 5. Default Sky Cutout Mock Object
export function createMockSkyCutout(ra = "08h55m10.831s", dec = "-07d14m42.53s", fov = 5.0) {
  return {
    target_info: {
      ra_deg: 133.795129,
      dec_deg: -7.245147,
      ra_hms: ra || "08h55m10.831s",
      dec_dms: dec || "-07d14m42.53s",
      fov_arcmin: parseFloat(fov) || 5.0,
      matched_preset: "WISE 0855",
      band_group: "stacked",
      stretch: "zscale",
      colormap: "inferno"
    },
    epochs: [
      {
        epoch_id: "epoch_1",
        timestamp: "2025-06-15",
        image_url: createMockStarSvg({ x: 0, y: 0 }),
        contamination_flag: false,
        target_pixel_coords: [128.0, 128.0]
      },
      {
        epoch_id: "epoch_2",
        timestamp: "2025-12-15",
        image_url: createMockStarSvg({ x: 7.5, y: -4.2 }),
        contamination_flag: false,
        target_pixel_coords: [135.5, 123.8]
      },
      {
        epoch_id: "epoch_3",
        timestamp: "2026-06-15",
        image_url: createMockStarSvg({ x: 15.0, y: -8.4 }),
        contamination_flag: false,
        target_pixel_coords: [143.0, 119.6]
      },
      {
        epoch_id: "epoch_4",
        timestamp: "2026-12-15",
        image_url: createMockStarSvg({ x: 22.5, y: -12.6 }),
        contamination_flag: false,
        target_pixel_coords: [150.5, 115.4]
      }
    ],
    difference_image_url: createMockStarSvg({ x: 7.5, y: -4.2 }, true),
    spectrum_preview: generateMockSpectrum("WISE 0855"),
    spherex_detector_arrays: MOCK_DETECTOR_ARRAYS
  };
}
