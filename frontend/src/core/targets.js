// One shared source for the bands and colours used on both pages.

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
// The band a spot opens in. One band needs a sixth of the downloads of all six together,
// and most stars are bright in this one.
export const DEFAULT_BAND = 1;

export const MARKER_COLORS = [
  { color: '#FF8A3D', label: 'Orange' },
  { color: '#5AB4FF', label: 'Blue' },
  { color: '#7EE0B5', label: 'Mint' },
  { color: '#C9A7FF', label: 'Lilac' },
];

export const DEFAULT_LOOK =
  'Press play. Most stars will stay still, so watch for any dot that moves or gets brighter or dimmer.';
