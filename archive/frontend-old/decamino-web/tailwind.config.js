
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.25rem',
        md: '1.5rem',
        lg: '2rem',
        xl: '2.5rem',
      },
    },
    extend: {
      screens: {
        xs: '360px',
        '2xl': '1536px',
        // Mod de afișare TV: pointer fin dar fără hover
        tv: { 'raw': '(hover: none) and (pointer: fine)' },
      },
      colors: {
        // Culorile DeCamino - bazate pe theme.js
        primary: {
          50: '#fef2f2',   // Very light red
          100: '#fee2e2',  // Light red
          200: '#fecaca',  // Lighter red
          300: '#fca5a5',  // Light red
          400: '#f87171',  // Medium light red
          500: '#E53935',  // DeCamino primary red
          600: '#dc2626',  // Darker red
          700: '#b91c1c',  // Dark red
          800: '#991b1b',  // Very dark red
          900: '#7f1d1d',  // Darkest red
        },
        secondary: {
          50: '#ffffff',   // Pure white
          100: '#fafafa',  // Very light gray
          200: '#f5f5f5',  // Light gray (DeCamino background)
          300: '#e5e5e5',  // Light gray
          400: '#d4d4d4',  // Medium light gray
          500: '#737373',  // Medium gray
          600: '#525252',  // Medium dark gray
          700: '#404040',  // Dark gray
          800: '#262626',  // Very dark gray
          900: '#171717',  // Darkest gray
        },
        // Culori semantice din theme.js
        success: '#4CAF50',    // Green
        warning: '#FF9800',    // Orange
        error: '#F44336',      // Red
        info: '#2196F3',       // Blue
        border: '#E0E0E0',     // Light gray border
        shadow: 'rgba(0, 0, 0, 0.1)', // Shadow
        text: {
          primary: '#222222',   // Dark text
          secondary: '#666666', // Gray text
        }
      }
    },
  },
  plugins: [],
}
