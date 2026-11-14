/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#FF8A3D',
        ink: 'var(--color-ink)',
        body: 'var(--color-body)',
        muted: 'var(--color-muted)',
        page: 'var(--color-page)',
        surface: 'var(--color-surface)',
        line: 'var(--color-line)',
        soft: 'var(--color-soft)',
        rust: 'var(--color-rust)',
        danger: 'var(--color-danger)',
        sky: '#0B1230',
        night: '#141C3A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
