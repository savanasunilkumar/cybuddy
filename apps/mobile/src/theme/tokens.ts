import { Platform } from 'react-native';

// Prism Theme - Teal/Green inspired palette
export const palette = {
  // Backgrounds
  background: '#F0FDF9',
  backgroundAlt: '#E6FAF5',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FDFC',

  // Borders
  border: '#B8E8DD',
  borderLight: '#D5F2EB',

  // Text
  textPrimary: '#082F2C',
  textSecondary: '#3F5C56',
  textMuted: '#6B8A82',

  // Brand (Prism teal)
  brand: '#0C9F85',
  brandLight: '#40D7BE',
  brandMuted: '#D8F7F0',
  brandDark: '#0A7E69',

  // Accents
  accent1: '#3FD8C0', // Teal
  accent2: '#6BC7FF', // Blue
  accent3: '#88EA88', // Green
  accent4: '#FFB366', // Orange
  accent5: '#FF8080', // Coral
  accent6: '#A78BFA', // Purple

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  // Service Colors
  canvas: '#E65100',
  outlook: '#0078D4',
  workday: '#7C3AED',
  cyride: '#DC2626',
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  pill: 999,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const shadows = {
  soft: Platform.select({
    ios: {
      shadowColor: '#0C9F85',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
  card: Platform.select({
    ios: {
      shadowColor: '#082F2C',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),
  elevated: Platform.select({
    ios: {
      shadowColor: '#0C9F85',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
    },
    android: {
      elevation: 8,
    },
    default: {},
  }),
  glow: Platform.select({
    ios: {
      shadowColor: '#40D7BE',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
    },
    android: {
      elevation: 6,
    },
    default: {},
  }),
};
