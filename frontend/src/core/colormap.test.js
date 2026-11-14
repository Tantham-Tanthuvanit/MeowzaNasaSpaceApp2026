import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSkyCutout, fetchShiftAndAdd, fetchDifferenceImage } from '../services/api';

describe('Colormap API querying', () => {
  let capturedUrls = [];

  beforeEach(() => {
    capturedUrls = [];
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      capturedUrls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ epochs: [], mock: true }),
      };
    }));
  });

  it('fetchSkyCutout defaults to inferno colormap when not specified', async () => {
    await fetchSkyCutout(133.795, -7.245, 'stacked', 5.0);
    expect(capturedUrls.length).toBe(1);
    expect(capturedUrls[0]).toContain('colormap=inferno');
  });

  it('fetchSkyCutout supports toggling to grayscale colormap', async () => {
    await fetchSkyCutout(133.795, -7.245, 'stacked', 5.0, 'grayscale');
    expect(capturedUrls.length).toBe(1);
    expect(capturedUrls[0]).toContain('colormap=grayscale');
  });

  it('fetchSkyCutout preserves backwards compatibility when onProgress is 5th argument', async () => {
    const progressFn = vi.fn();
    await fetchSkyCutout(150.0, 10.0, 'stacked', 5.0, progressFn);
    expect(capturedUrls.length).toBe(1);
    expect(capturedUrls[0]).toContain('colormap=inferno');
  });

  it('fetchShiftAndAdd passes specified colormap', async () => {
    await fetchShiftAndAdd(133.795, -7.245, 'array_1', 1.0, -1.0, 5.0, 'grayscale');
    expect(capturedUrls.length).toBe(1);
    expect(capturedUrls[0]).toContain('colormap=grayscale');
  });

  it('fetchDifferenceImage passes specified colormap', async () => {
    await fetchDifferenceImage(133.795, -7.245, 'array_1', 0, 1, 5.0, 'inferno');
    expect(capturedUrls.length).toBe(1);
    expect(capturedUrls[0]).toContain('colormap=inferno');
  });
});
