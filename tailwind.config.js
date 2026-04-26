/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      colors: {
        ink: {
          0: '#0a0908',
          50: '#0f0e0d',
          100: '#161514',
          200: '#1f1d1b',
          300: '#2a2826',
          400: '#3a3835',
          500: '#5b5853',
          600: '#7a7670',
          700: '#9b9893',
          800: '#c8c5bf',
          900: '#f5f3ef'
        },
        signal: {
          red: '#ff4d2e',
          amber: '#ffa629',
          green: '#3ed598',
          blue: '#4d8eff'
        }
      },
      boxShadow: {
        'inset-line': 'inset 0 -1px 0 rgba(255,255,255,0.06)'
      }
    }
  },
  plugins: []
};
