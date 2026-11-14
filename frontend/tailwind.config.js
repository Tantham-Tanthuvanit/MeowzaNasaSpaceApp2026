/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#FF8A3D',
        ink: '#141A2E',
        body: '#3A4560',
        muted: '#5A6580',
        page: '#F5F7FB',
        line: '#CCD3E0',
        soft: '#DDE2EC',
        rust: '#B4460F',
        danger: '#B42318',
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
