
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
        // Brand primary – 500/600/700 din CSS vars (per client: DeCamino roșu, HERA albastru)
        primary: {
          50: 'var(--primary-color-rgba-01, #fef2f2)',
          100: 'var(--primary-color-rgba-02, #fee2e2)',
          200: 'var(--primary-color-rgba-02, #fecaca)',
          300: 'var(--primary-color-rgba-04, #fca5a5)',
          400: 'var(--primary-color-rgba-05, #f87171)',
          500: 'var(--primary-color, #E53935)',
          600: 'var(--primary-color-darker, #dc2626)',
          700: 'var(--primary-color-darkest, #b91c1c)',
          800: 'var(--primary-color-darkest, #991b1b)',
          900: 'var(--primary-color-darkest, #7f1d1d)',
        },
        // Red = brand primary per client (butoane, taburi, focus) – toate red-* devin culoarea brand
        red: {
          50: 'var(--primary-color-rgba-01, #fef2f2)',
          100: 'var(--primary-color-rgba-02, #fee2e2)',
          200: 'var(--primary-color-rgba-02, #fecaca)',
          300: 'var(--primary-color-rgba-04, #fca5a5)',
          400: 'var(--primary-color-rgba-05, #f87171)',
          500: 'var(--primary-color, #E53935)',
          600: 'var(--primary-color-darker, #dc2626)',
          700: 'var(--primary-color-darkest, #b91c1c)',
          800: 'var(--primary-color-darkest, #991b1b)',
          900: 'var(--primary-color-darkest, #7f1d1d)',
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
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.3s ease-out',
      },
      keyframes: {
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      }
    },
  },
  plugins: [],
}
