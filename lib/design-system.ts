/**
 * Design System - Complete token definitions from approved Claude Design file
 * Source: https://claude.ai/design → Shopping List mockup
 * Updated: 2026-05-19
 */

// ─── Color Tokens ───
export const colors = {
  // Primary background
  cream: '#FAF6EE',
  // Surface (cards, inputs)
  surface: '#FFFFFF',

  // Text (ink = primary dark text)
  ink: '#1C1B17',
  ink70: 'rgba(28,27,23,0.7)',
  ink50: 'rgba(28,27,23,0.5)',
  ink30: 'rgba(28,27,23,0.3)',
  ink10: 'rgba(28,27,23,0.1)',
  ink06: 'rgba(28,27,23,0.06)',

  // Primary accent (peach/sage in variable names, but actually peach)
  accent: '#F4B5A0',
  accentDark: '#C77858',
  accentBg: '#FBE5DC',

  // Destructive
  danger: '#B14A33',

  // List type tints
  listTypes: {
    supermarket: '#FBE5DC',
    pharmacy: '#E4EEF3',
    house: '#F2E9D5',
  },

  // Section tints (by type)
  sections: {
    supermarket: {
      milk: { bg: '#E7F1F7', ink: '#3B6C8C' },
      produce: { bg: '#E8F1DD', ink: '#4F6E32' },
      meat: { bg: '#F6E0DA', ink: '#A0432F' },
      dry: { bg: '#F2E9D5', ink: '#8A6A2B' },
      baking: { bg: '#F7E2E8', ink: '#A24566' },
      cleaning: { bg: '#DEEFEC', ink: '#3E7C76' },
      snacks: { bg: '#FAE7CB', ink: '#A86220' },
      drinks: { bg: '#E6E2F0', ink: '#564B86' },
      frozen: { bg: '#E0EBF2', ink: '#3D6580' },
      other: { bg: '#ECEAE5', ink: '#5A554B' },
    },
    pharmacy: {
      home: { bg: '#DEEFEC', ink: '#3E7C76' },
      hygiene: { bg: '#E6E2F0', ink: '#564B86' },
      meds: { bg: '#F6E0DA', ink: '#A0432F' },
      other: { bg: '#ECEAE5', ink: '#5A554B' },
    },
    house: {
      kitchen: { bg: '#EFEAD9', ink: '#7D6B36' },
      storage: { bg: '#F2E9D5', ink: '#8A6A2B' },
      furniture: { bg: '#F4EBDA', ink: '#7A4E2C' },
      electric: { bg: '#FAE7CB', ink: '#A86220' },
      other: { bg: '#ECEAE5', ink: '#5A554B' },
    },
  },

  // Avatar backgrounds
  avatars: {
    member1: '#C7D8BB', // אילון
    member2: '#F2C9B1', // דנה
  },
};

// ─── Typography ───
export const typography = {
  // Font family (Heebo with fallbacks)
  fontFamily: `'Heebo', system-ui, -apple-system, 'Noto Sans Hebrew', sans-serif`,

  // Heading sizes
  heading: {
    h1: { fontSize: '30px', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1 },
    h2: { fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontSize: '16px', fontWeight: 700 },
  },

  // Body text
  body: {
    large: { fontSize: '17px', fontWeight: 600, letterSpacing: '-0.02em' },
    base: { fontSize: '16px', fontWeight: 600 },
    medium: { fontSize: '15px', fontWeight: 500 },
    small: { fontSize: '13px', fontWeight: 600 },
    xs: { fontSize: '11px', fontWeight: 600 },
  },

  // Specific semantic sizes
  listCard: { fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em' },
  itemName: { fontSize: '16px', fontWeight: 600 },
  itemQty: { fontSize: '13px', fontWeight: 500 },
  sectionLabel: { fontSize: '13px', fontWeight: 600, letterSpacing: '-0.005em' },
};

// ─── Spacing ───
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '32px',
  '4xl': '40px',
};

// ─── Border Radius ───
export const borderRadius = {
  sm: '12px',
  md: '14px',
  lg: '18px',
  xl: '22px',
  '2xl': '24px',
  '3xl': '28px',
  full: '999px',
};

// ─── Component Sizes ───
export const components = {
  // Buttons
  button: {
    height: '50px',
    minHeight: '50px',
    borderRadius: borderRadius.full,
    padding: '0 22px',
  },

  // Icon buttons / checkboxes
  iconButton: {
    size: '44px',
    borderRadius: borderRadius.sm,
  },

  // Input fields
  input: {
    height: '52px',
    borderRadius: borderRadius.md,
    padding: '0 16px',
  },

  // List card
  listCard: {
    borderRadius: borderRadius.xl,
    padding: '16px',
  },

  // Item row
  itemRow: {
    minHeight: '56px',
    padding: '4px 6px 4px 4px',
  },

  // Section card
  sectionCard: {
    borderRadius: borderRadius.xl,
    padding: '10px',
  },

  // Top bar
  topBar: {
    padding: '14px 14px 8px',
  },

  // Emoji size in cards/buttons
  emoji: {
    listCard: '28px',
    listTypeChip: '15px',
    section: '20px',
  },

  // Minimum touch target (44×44)
  tapTarget: '44px',
};

// ─── List Types & Metadata ───
export const listTypes = {
  supermarket: {
    id: 'supermarket',
    label: 'סופר',
    emoji: '🛒',
    tint: colors.listTypes.supermarket,
  },
  pharmacy: {
    id: 'pharmacy',
    label: 'בית מרקחת',
    emoji: '💊',
    tint: colors.listTypes.pharmacy,
  },
  house: {
    id: 'house',
    label: 'בית',
    emoji: '🏠',
    tint: colors.listTypes.house,
  },
};

// ─── Shadows ───
export const shadows = {
  card: '0 1px 0 rgba(28,27,23,0.06), 0 1px 2px rgba(0,0,0,0.03)',
  sheet: '0 -20px 60px rgba(0,0,0,0.18)',
  modal: '0 30px 80px rgba(0,0,0,0.25)',
  toast: '0 8px 24px rgba(0,0,0,0.2)',
};

// ─── Transitions ───
export const transitions = {
  fast: '0.12s',
  base: '0.15s',
  slow: '0.25s',
  slowest: '0.3s',
  easeOut: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
};

// ─── Z-Index Stack ───
export const zIndex = {
  base: 1,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  sheet: 50,
  modal: 60,
  toast: 70,
};
