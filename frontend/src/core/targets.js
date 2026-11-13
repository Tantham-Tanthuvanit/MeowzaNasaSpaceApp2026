// One shared source for the stars, bands and colours used on both pages.

// The six SPHEREx detector bands. `id` is the backend's band_group value.
export const BANDS = [
  { n: 1, id: 'array_1', range: '0.75–1.11', color: '#3D5BE0' },
  { n: 2, id: 'array_2', range: '1.11–1.64', color: '#1FA2B8' },
  { n: 3, id: 'array_3', range: '1.64–2.42', color: '#2FA85A' },
  { n: 4, id: 'array_4', range: '2.42–3.82', color: '#E2B41F' },
  { n: 5, id: 'array_5', range: '3.82–4.42', color: '#EE7F22' },
  { n: 6, id: 'array_6', range: '4.42–5.00', color: '#D2362F' },
];
export const ALL_BANDS = [1, 2, 3, 4, 5, 6];

export const MARKER_COLORS = [
  { color: '#FF8A3D', label: 'Orange' },
  { color: '#5AB4FF', label: 'Blue' },
  { color: '#7EE0B5', label: 'Mint' },
  { color: '#C9A7FF', label: 'Lilac' },
];

// Plain-language text for the five challenge stars, keyed by the backend's preset id.
const FRIENDLY = {
  barnards_star: {
    kind: 'A star on the move',
    look: 'This nearby star moves across the sky faster than almost any other. Watch the bright dot in the middle creep along while the other stars stay still.',
  },
  epsilon_indi_b: {
    kind: 'Two “failed stars”',
    look: 'Brown dwarfs are too small to shine like real stars. Here two of them travel together. Look for faint dots drifting as a pair. Tip: they glow brightest in Band 5 or 6.',
  },
  wise_0855: {
    kind: 'A speedy “failed star”',
    look: 'A brown dwarf is too small to shine like a real star, but this one moves fast. Look for the faint dot sliding across the picture. It is the only thing that moves. Tip: brown dwarfs glow brightest in the longest waves, so try Band 5 or 6.',
  },
  rw_aurigae: {
    kind: 'A star that flickers',
    look: 'Some stars change how bright they are. Watch the dot in the middle: it stays in place but gets brighter and dimmer.',
  },
  r_draconis: {
    kind: 'A star that pulses',
    look: 'This giant star slowly swells in brightness, then fades. Watch the dot in the middle grow and shrink.',
  },
};

export const DEFAULT_LOOK =
  'Press play. Most stars will stay still, so watch for any dot that moves or gets brighter or dimmer.';

// Turn a backend preset into what the UI shows. The five challenge stars get friendly text;
// any other backend target keeps the backend's own category and description.
export function toTarget(preset) {
  const friendly = FRIENDLY[preset.id];
  return {
    id: preset.id,
    name: preset.name,
    ra: preset.ra_deg,
    dec: preset.dec_deg,
    kind: friendly ? friendly.kind : preset.category,
    look: friendly ? friendly.look : preset.expected_phenomenon || preset.description || DEFAULT_LOOK,
  };
}

// The target (if any) that sits at this position, within about 3 arcminutes.
export function targetAt(targets, ra, dec) {
  return (
    targets.find(
      (t) => Math.abs(t.dec - dec) < 0.05 && Math.abs(t.ra - ra) * Math.cos((dec * Math.PI) / 180) < 0.05
    ) || null
  );
}

// Example projects every visitor starts with.
export const SEED_PROJECTS = [
  { id: 'seed-barnard', name: "Barnard's Star", star: "Barnard's Star", kind: FRIENDLY.barnards_star.kind, color: '#FF8A3D',
    ra: 269.452075, dec: 4.693389, bands: ALL_BANDS, created: '2 Nov 2026',
    desc: 'The fastest-moving star in our sky. Watch it creep along while every other star stays put.' },
  { id: 'seed-eps', name: 'Twin brown dwarfs', star: 'Epsilon Indi B', kind: FRIENDLY.epsilon_indi_b.kind, color: '#C9A7FF',
    ra: 331.04375, dec: -56.782778, bands: [4, 5, 6], created: '4 Nov 2026',
    desc: 'Two brown dwarfs orbiting each other, drifting across the sky as a pair.' },
  { id: 'seed-wise', name: 'The speedy brown dwarf', star: 'WISE 0855', kind: FRIENDLY.wise_0855.kind, color: '#5AB4FF',
    ra: 133.795129, dec: -7.245147, bands: [5, 6], created: '6 Nov 2026',
    desc: 'One of the coldest, closest brown dwarfs. A faint dot that slides across the picture.' },
  { id: 'seed-rwaur', name: 'RW Aurigae flicker watch', star: 'RW Aurigae', kind: FRIENDLY.rw_aurigae.kind, color: '#7EE0B5',
    ra: 76.956542, dec: 30.401417, bands: ALL_BANDS, created: '9 Nov 2026',
    desc: 'A young star wrapped in dust that brightens and dims without warning.' },
  { id: 'seed-rdra', name: 'R Draconis pulse', star: 'R Draconis', kind: FRIENDLY.r_draconis.kind, color: '#FF8A3D',
    ra: 248.167625, dec: 66.754972, bands: ALL_BANDS, created: '11 Nov 2026',
    desc: 'A giant star that slowly swells in brightness, then fades again.' },
];
