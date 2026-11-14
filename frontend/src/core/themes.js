/**
 * Monkeytype-style theme definitions and management for SkyFlip.
 * Each theme defines a complete, accessible color scheme mapped to CSS custom properties.
 */

export const THEMES = [
  {
    id: 'deep-spruce',
    name: 'Deep Spruce',
    type: 'dark',
    featured: 'Coolors #1',
    description: 'Midnight spruce, misty sage, air force blue, and ivory starlight',
    sourceUrl: 'https://coolors.co/palette/01161e-124559-598392-aec3b0-eff6e0',
    palette: ['#01161E', '#124559', '#EFF6E0', '#AEC3B0', '#598392'],
    vars: {
      '--color-page': '#01161E',
      '--color-surface': '#124559',
      '--color-line': '#246076',
      '--color-soft': '#1B4E61',
      '--color-ink': '#EFF6E0',
      '--color-body': '#D5E4D2',
      '--color-muted': '#8BAAB7',
      '--color-accent': '#AEC3B0',
      '--color-accent-text': '#01161E',
      '--color-rust': '#AEC3B0',
      '--color-danger': '#F87171',
    },
  },
  {
    id: 'retro-sunset',
    name: 'Retro Sunset',
    type: 'light',
    featured: 'Coolors #2',
    description: 'Warm cream, apricot peach, coral sunset, and deep cerulean ocean',
    sourceUrl: 'https://coolors.co/palette/0081a7-00afb9-fdfcdc-fed9b7-f07167',
    palette: ['#FDFCDC', '#FFFFFF', '#013242', '#0081A7', '#F07167'],
    vars: {
      '--color-page': '#FDFCDC',
      '--color-surface': '#FFFFFF',
      '--color-line': '#FED9B7',
      '--color-soft': '#FBE5D2',
      '--color-ink': '#013242',
      '--color-body': '#006381',
      '--color-muted': '#007D8C',
      '--color-accent': '#F07167',
      '--color-accent-text': '#FFFFFF',
      '--color-rust': '#E05A4F',
      '--color-danger': '#D92D20',
    },
  },
  {
    id: 'ocean-coral',
    name: 'Ocean Coral',
    type: 'dark',
    featured: 'Coolors #2 Dark',
    description: 'Deep cerulean ocean depths with glowing coral and verdigris cyan',
    sourceUrl: 'https://coolors.co/palette/0081a7-00afb9-fdfcdc-fed9b7-f07167',
    palette: ['#002230', '#004359', '#FDFCDC', '#00AFB9', '#F07167'],
    vars: {
      '--color-page': '#002230',
      '--color-surface': '#004359',
      '--color-line': '#006887',
      '--color-soft': '#00546F',
      '--color-ink': '#FDFCDC',
      '--color-body': '#FED9B7',
      '--color-muted': '#00AFB9',
      '--color-accent': '#F07167',
      '--color-accent-text': '#FFFFFF',
      '--color-rust': '#FED9B7',
      '--color-danger': '#F87171',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight SPHEREx',
    type: 'dark',
    description: 'Deep space dark navy with high-contrast starlight and solar amber',
    palette: ['#0B1020', '#131B33', '#F0F4FC', '#94A3B8', '#FF8A3D'],
    vars: {
      '--color-page': '#0B1020',
      '--color-surface': '#131B33',
      '--color-line': '#2E3B5E',
      '--color-soft': '#232E4D',
      '--color-ink': '#F0F4FC',
      '--color-body': '#CBD5E8',
      '--color-muted': '#94A3B8',
      '--color-accent': '#FF8A3D',
      '--color-accent-text': '#0B1020',
      '--color-rust': '#FF9F5A',
      '--color-danger': '#F97066',
    },
  },
  {
    id: 'skyflip-light',
    name: 'SkyFlip Classic',
    type: 'light',
    description: 'Warm scientific paper, dark navy ink, and signature solar orange',
    palette: ['#F5F7FB', '#FFFFFF', '#141A2E', '#5A6580', '#FF8A3D'],
    vars: {
      '--color-page': '#F5F7FB',
      '--color-surface': '#FFFFFF',
      '--color-line': '#CCD3E0',
      '--color-soft': '#DDE2EC',
      '--color-ink': '#141A2E',
      '--color-body': '#3A4560',
      '--color-muted': '#5A6580',
      '--color-accent': '#FF8A3D',
      '--color-accent-text': '#0B1020',
      '--color-rust': '#B4460F',
      '--color-danger': '#B42318',
    },
  },
  {
    id: 'nordic-frost',
    name: 'Nordic Frost',
    type: 'dark',
    description: 'Arctic polar night, glacial blue ice, and clean snowfall',
    palette: ['#242933', '#2E3440', '#ECEFF4', '#D8DEE9', '#88C0D0'],
    vars: {
      '--color-page': '#242933',
      '--color-surface': '#2E3440',
      '--color-line': '#434C5E',
      '--color-soft': '#3B4252',
      '--color-ink': '#ECEFF4',
      '--color-body': '#E5E9F0',
      '--color-muted': '#88C0D0',
      '--color-accent': '#88C0D0',
      '--color-accent-text': '#242933',
      '--color-rust': '#81A1C1',
      '--color-danger': '#BF616A',
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    type: 'dark',
    description: 'High-tech neon cyan and hot magenta across an obsidian matrix',
    palette: ['#08090D', '#12141F', '#F0F6FC', '#00F0FF', '#FF007F'],
    vars: {
      '--color-page': '#08090D',
      '--color-surface': '#12141F',
      '--color-line': '#252A42',
      '--color-soft': '#1B1E30',
      '--color-ink': '#F0F6FC',
      '--color-body': '#C4D1EB',
      '--color-muted': '#00F0FF',
      '--color-accent': '#FF007F',
      '--color-accent-text': '#FFFFFF',
      '--color-rust': '#00F0FF',
      '--color-danger': '#FF3366',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    type: 'light',
    description: 'Precision laboratory parchment with solar blue and golden amber',
    palette: ['#FDF6E3', '#F4EFE0', '#073642', '#586E75', '#268BD2'],
    vars: {
      '--color-page': '#FDF6E3',
      '--color-surface': '#F4EFE0',
      '--color-line': '#DCD5BF',
      '--color-soft': '#E6DFCC',
      '--color-ink': '#073642',
      '--color-body': '#2E4E57',
      '--color-muted': '#586E75',
      '--color-accent': '#268BD2',
      '--color-accent-text': '#FFFFFF',
      '--color-rust': '#B58900',
      '--color-danger': '#DC322F',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai Infrared',
    type: 'dark',
    description: 'Charcoal dark with luminous lime, golden yellow, and neon pink',
    palette: ['#1E1F1C', '#272822', '#F8F8F2', '#A6E22E', '#FD971F'],
    vars: {
      '--color-page': '#1E1F1C',
      '--color-surface': '#272822',
      '--color-line': '#49483E',
      '--color-soft': '#383830',
      '--color-ink': '#F8F8F2',
      '--color-body': '#CFD0C2',
      '--color-muted': '#A6E22E',
      '--color-accent': '#FD971F',
      '--color-accent-text': '#1E1F1C',
      '--color-rust': '#E6DB74',
      '--color-danger': '#F92672',
    },
  },
];

export const DEFAULT_THEME_ID = 'skyflip-light';
export const DEFAULT_DARK_THEME_ID = 'midnight';

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES.find((t) => t.id === DEFAULT_THEME_ID) || THEMES[0];
}

export function getInitialTheme() {
  try {
    const savedId = localStorage.getItem('skyflip_theme_id');
    if (savedId && THEMES.some((t) => t.id === savedId)) {
      return getTheme(savedId);
    }
    const legacyDark = localStorage.getItem('skyflip_theme') === 'dark';
    return legacyDark ? getTheme(DEFAULT_DARK_THEME_ID) : getTheme(DEFAULT_THEME_ID);
  } catch {
    return getTheme(DEFAULT_THEME_ID);
  }
}

export function applyTheme(themeOrId) {
  const theme = typeof themeOrId === 'string' ? getTheme(themeOrId) : themeOrId;
  if (!theme || typeof document === 'undefined') return theme;

  const root = document.documentElement;
  const isDark = theme.type === 'dark';

  root.classList.toggle('dark', isDark);

  if (theme.vars) {
    Object.entries(theme.vars).forEach(([prop, val]) => {
      root.style.setProperty(prop, val);
    });
    root.style.setProperty('color-scheme', isDark ? 'dark' : 'light');
  }

  try {
    localStorage.setItem('skyflip_theme_id', theme.id);
    localStorage.setItem('skyflip_theme', theme.type);
  } catch {
    // ignore storage restrictions
  }

  return theme;
}
