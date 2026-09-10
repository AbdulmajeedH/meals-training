import type { TextStyle } from 'react-native';

/**
 * IBM Plex Sans Arabic, four weights.
 * Loaded in app/_layout.tsx under exactly these keys.
 */
export const font = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
} as const;

/**
 * Optical sizing, done by hand: the bigger the type, the tighter the tracking
 * and the tighter the leading. Small text gets air, display text gets none.
 * Numbers are the loudest thing on every screen, hence `display` and `metric`.
 */
export const type = {
  display: {
    fontFamily: font.bold,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1.4,
  },
  metric: {
    fontFamily: font.semibold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.7,
  },
  title: {
    fontFamily: font.semibold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  heading: {
    fontFamily: font.semibold,
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: 0,
  },
  label: {
    fontFamily: font.medium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
} satisfies Record<string, TextStyle>;

export type TypeToken = keyof typeof type;
