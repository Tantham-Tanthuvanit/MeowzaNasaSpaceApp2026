import { describe, it, expect, beforeEach, vi } from 'vitest';
import { THEMES, getTheme, getInitialTheme, applyTheme, DEFAULT_THEME_ID, DEFAULT_DARK_THEME_ID } from './themes';

describe('Themes System (Monkeytype style)', () => {
  let mockStorage = {};
  let mockClasses = new Set();
  let mockStyles = {};

  beforeEach(() => {
    mockStorage = {};
    mockClasses = new Set();
    mockStyles = {};

    vi.stubGlobal('localStorage', {
      getItem: (k) => mockStorage[k] ?? null,
      setItem: (k, v) => { mockStorage[k] = String(v); },
      clear: () => { mockStorage = {}; },
    });

    vi.stubGlobal('document', {
      documentElement: {
        classList: {
          contains: (cls) => mockClasses.has(cls),
          toggle: (cls, force) => {
            if (force === undefined) {
              if (mockClasses.has(cls)) mockClasses.delete(cls);
              else mockClasses.add(cls);
            } else if (force) {
              mockClasses.add(cls);
            } else {
              mockClasses.delete(cls);
            }
          },
        },
        style: {
          setProperty: (prop, val) => { mockStyles[prop] = String(val); },
          getPropertyValue: (prop) => mockStyles[prop] ?? '',
        },
      },
    });
  });

  it('contains valid theme definitions including Coolors palettes #1 and #2', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(9);

    const spruce = THEMES.find((t) => t.id === 'deep-spruce');
    expect(spruce).toBeDefined();
    expect(spruce.vars['--color-page']).toBe('#01161E');
    expect(spruce.vars['--color-surface']).toBe('#124559');
    expect(spruce.vars['--color-ink']).toBe('#EFF6E0');
    expect(spruce.vars['--color-accent']).toBe('#AEC3B0');
    expect(spruce.type).toBe('dark');

    const sunset = THEMES.find((t) => t.id === 'retro-sunset');
    expect(sunset).toBeDefined();
    expect(sunset.vars['--color-page']).toBe('#FDFCDC');
    expect(sunset.vars['--color-accent']).toBe('#F07167');
    expect(sunset.type).toBe('light');

    const ocean = THEMES.find((t) => t.id === 'ocean-coral');
    expect(ocean).toBeDefined();
    expect(ocean.vars['--color-accent']).toBe('#F07167');
    expect(ocean.type).toBe('dark');
  });

  it('every theme has all required CSS variables and 5-color palette', () => {
    const requiredVars = [
      '--color-page',
      '--color-surface',
      '--color-line',
      '--color-soft',
      '--color-ink',
      '--color-body',
      '--color-muted',
      '--color-accent',
      '--color-accent-text',
      '--color-rust',
      '--color-danger',
    ];

    THEMES.forEach((theme) => {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      expect(['dark', 'light']).toContain(theme.type);
      expect(theme.palette).toHaveLength(5);
      requiredVars.forEach((v) => {
        expect(theme.vars[v], `Theme ${theme.id} missing ${v}`).toBeDefined();
      });
    });
  });

  it('getTheme falls back safely for unknown id', () => {
    expect(getTheme('nonexistent-id').id).toBe(DEFAULT_THEME_ID);
  });

  it('applyTheme updates document style, dark class, and localStorage', () => {
    const applied = applyTheme('deep-spruce');
    expect(applied.id).toBe('deep-spruce');
    expect(mockClasses.has('dark')).toBe(true);
    expect(mockStyles['--color-page']).toBe('#01161E');
    expect(mockStorage.skyflip_theme_id).toBe('deep-spruce');
    expect(mockStorage.skyflip_theme).toBe('dark');

    // Switch to light theme
    const light = applyTheme('retro-sunset');
    expect(light.id).toBe('retro-sunset');
    expect(mockClasses.has('dark')).toBe(false);
    expect(mockStyles['--color-page']).toBe('#FDFCDC');
    expect(mockStorage.skyflip_theme_id).toBe('retro-sunset');
    expect(mockStorage.skyflip_theme).toBe('light');
  });

  it('getInitialTheme honors existing legacy dark preference', () => {
    mockStorage.skyflip_theme = 'dark';
    expect(getInitialTheme().id).toBe(DEFAULT_DARK_THEME_ID);

    mockStorage.skyflip_theme_id = 'deep-spruce';
    expect(getInitialTheme().id).toBe('deep-spruce');
  });
});
