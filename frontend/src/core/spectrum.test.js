import { describe, expect, it } from 'vitest';
import {
  SPECTRAL_FEATURES,
  findNearestFeature,
  wavelengthToColor,
  calculateContinuum,
  detectSpectralFeatures,
} from './spectrum';

describe('Spectral features catalogue', () => {
  it('contains both absorption and emission features across the SPHEREx band range', () => {
    const absorptions = SPECTRAL_FEATURES.filter((f) => f.type === 'absorption');
    const emissions = SPECTRAL_FEATURES.filter((f) => f.type === 'emission');

    expect(absorptions.length).toBeGreaterThanOrEqual(5);
    expect(emissions.length).toBeGreaterThanOrEqual(4);

    // Verify key cosmic infrared markers
    expect(absorptions.some((f) => f.id === 'h2o_ice' && f.wavelength_um === 3.05)).toBe(true);
    expect(absorptions.some((f) => f.id === 'ch4_overtone' && f.wavelength_um === 1.66)).toBe(true);
    expect(absorptions.some((f) => f.id === 'co2_ice' && f.wavelength_um === 4.27)).toBe(true);

    expect(emissions.some((f) => f.id === 'br_alpha' && f.wavelength_um === 4.052)).toBe(true);
    expect(emissions.some((f) => f.id === 'pa_alpha' && f.wavelength_um === 1.875)).toBe(true);
  });

  it('findNearestFeature identifies features within tolerance', () => {
    const h2o = findNearestFeature(3.052, 0.05);
    expect(h2o).not.toBeNull();
    expect(h2o.id).toBe('h2o_ice');

    const brAlpha = findNearestFeature(4.05, 0.05);
    expect(brAlpha).not.toBeNull();
    expect(brAlpha.id).toBe('br_alpha');

    // Outside tolerance returns null
    const distant = findNearestFeature(2.80, 0.05);
    expect(distant).toBeNull();
  });

  it('wavelengthToColor returns appropriate false-color hex for bands', () => {
    expect(wavelengthToColor(0.85)).toBe('#3D5BE0'); // Band 1
    expect(wavelengthToColor(1.30)).toBe('#1FA2B8'); // Band 2
    expect(wavelengthToColor(2.00)).toBe('#2FA85A'); // Band 3
    expect(wavelengthToColor(3.00)).toBe('#E2B41F'); // Band 4
    expect(wavelengthToColor(4.10)).toBe('#EE7F22'); // Band 5
    expect(wavelengthToColor(4.80)).toBe('#D2362F'); // Band 6
  });

  it('calculateContinuum computes median baseline smoothly', () => {
    const points = [
      { wavelength_um: 1.0, flux_mjy_sr: 10 },
      { wavelength_um: 1.2, flux_mjy_sr: 10 },
      { wavelength_um: 1.4, flux_mjy_sr: 10 },
      { wavelength_um: 1.6, flux_mjy_sr: 2 }, // dip (absorption)
      { wavelength_um: 1.8, flux_mjy_sr: 10 },
      { wavelength_um: 2.0, flux_mjy_sr: 10 },
      { wavelength_um: 2.2, flux_mjy_sr: 10 },
    ];
    const continuum = calculateContinuum(points, 5);
    expect(continuum.length).toBe(7);
    expect(continuum[3].continuum_flux).toBe(10);
  });

  it('detectSpectralFeatures distinguishes dips as absorption and peaks as emission', () => {
    const points = [
      { channel: 1, wavelength_um: 1.0, flux_mjy_sr: 10 },
      { channel: 2, wavelength_um: 1.2, flux_mjy_sr: 10 },
      { channel: 3, wavelength_um: 1.4, flux_mjy_sr: 10 },
      { channel: 4, wavelength_um: 1.66, flux_mjy_sr: 4 }, // absorption dip near CH4
      { channel: 5, wavelength_um: 1.8, flux_mjy_sr: 10 },
      { channel: 6, wavelength_um: 2.0, flux_mjy_sr: 10 },
      { channel: 7, wavelength_um: 2.2, flux_mjy_sr: 10 },
      { channel: 8, wavelength_um: 3.0, flux_mjy_sr: 10 },
      { channel: 9, wavelength_um: 4.05, flux_mjy_sr: 25 }, // emission peak near Br-alpha
      { channel: 10, wavelength_um: 4.2, flux_mjy_sr: 10 },
      { channel: 11, wavelength_um: 4.5, flux_mjy_sr: 10 },
    ];
    const detected = detectSpectralFeatures(points);
    expect(detected.absorption.length).toBeGreaterThanOrEqual(1);
    expect(detected.emission.length).toBeGreaterThanOrEqual(1);

    const ch4Match = detected.absorption.find((p) => p.matchedFeature?.id === 'ch4_overtone');
    expect(ch4Match).toBeDefined();

    const brMatch = detected.emission.find((p) => p.matchedFeature?.id === 'br_alpha');
    expect(brMatch).toBeDefined();
  });
});
