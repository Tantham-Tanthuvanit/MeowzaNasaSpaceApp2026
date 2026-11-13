/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        space: {
          950: '#070a13',
          900: '#0d1526',
          850: '#111c33',
          800: '#162238',
          700: '#1e3050',
          600: '#2a436e'
        },
        spherex: {
          cyan: '#38bdf8',
          amber: '#f59e0b',
          indigo: '#818cf8',
          emerald: '#10b981',
          rose: '#f43f5e'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      animation: {
        'spin-slow': 'spin 12s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
