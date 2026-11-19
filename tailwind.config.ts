import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: `'Heebo', system-ui, -apple-system, 'Noto Sans Hebrew', sans-serif`,
      },
      colors: {
        // Primary background
        cream: '#FAF6EE',
        surface: '#FFFFFF',

        // Text (ink scale)
        ink: '#1C1B17',
        'ink-70': 'rgba(28,27,23,0.7)',
        'ink-50': 'rgba(28,27,23,0.5)',
        'ink-30': 'rgba(28,27,23,0.3)',
        'ink-10': 'rgba(28,27,23,0.1)',
        'ink-06': 'rgba(28,27,23,0.06)',

        // Accent (peach)
        accent: '#F4B5A0',
        'accent-dark': '#C77858',
        'accent-bg': '#FBE5DC',

        // Destructive
        danger: '#B14A33',

        // Legacy/mappings for existing code
        primary: '#F4B5A0',
        secondary: '#F4B5A0',
        background: '#FAF6EE',
        error: '#B14A33',
        errorBg: '#F6E0DA',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
      },
      borderRadius: {
        sm: '12px',
        md: '14px',
        lg: '18px',
        xl: '22px',
        '2xl': '24px',
        '3xl': '28px',
      },
      minHeight: {
        tap: '44px',
      },
      minWidth: {
        tap: '44px',
      },
      boxShadow: {
        card: '0 1px 0 rgba(28,27,23,0.06), 0 1px 2px rgba(0,0,0,0.03)',
        'card-elevated': '0 8px 24px rgba(28,27,23,0.18)',
        sheet: '0 -20px 60px rgba(0,0,0,0.18)',
        modal: '0 30px 80px rgba(0,0,0,0.25)',
        toast: '0 8px 24px rgba(0,0,0,0.2)',
      },
    },
  },
  plugins: [require('tailwindcss-rtl')],
};

export default config;
