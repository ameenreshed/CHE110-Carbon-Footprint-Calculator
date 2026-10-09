/* ==========================================================================
   Carbotrack — tailwind-config.js
   Must be loaded SYNCHRONOUSLY (no defer/async) right after the Tailwind CDN.
   ========================================================================== */
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        forest: {
          50:  '#f2f7f4',
          100: '#e1ede7',
          200: '#c5ddcf',
          300: '#9dc4b1',
          400: '#6fa58e',
          500: '#4d8871',
          600: '#396d59',
          700: '#2f5747',
          800: '#28463a',
          900: '#1b3027',
          950: '#0d1a15'
        },
        leaf: {
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857'
        },
        sage: '#98a89e',
        earth: '#fbf9f5',
        earthSand: '#efe9dc'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Poppins', 'sans-serif']
      }
    }
  }
};