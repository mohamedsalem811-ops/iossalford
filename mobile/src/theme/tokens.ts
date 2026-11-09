import type { TextStyle } from 'react-native';

/** 4-point spacing scale (docs/DESIGN.md). Screen edge padding is `md`. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  ms: 12,
  md: 16,
  ml: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Corner radii. Pair non-capsule values with borderCurve: 'continuous'. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  card: 24,
  hero: 28,
  full: 9999,
} as const;

/** Font family names, as loaded in the root layout. */
export const fonts = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
  logoJewelry: 'PlayfairDisplay_800ExtraBold',
  logoJewelryText: 'PlayfairDisplay_600SemiBold',
  logoJewelryLight: 'PlayfairDisplay_500Medium',
  logoScarves: 'CormorantGaramond_600SemiBold',
  logoScarvesText: 'CormorantGaramond_500Medium',
  logoScarvesItalic: 'CormorantGaramond_500Medium_Italic',
} as const;

/**
 * Named text styles. Static font files carry the weight, so fontWeight is left out
 * (otherwise iOS may synthesize it or fall back to the system font).
 */
export const type = {
  largeTitle: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 40 },
  title: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28 },
  headline: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 24 },
  subhead: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  hero: { fontFamily: fonts.bold, fontSize: 38, lineHeight: 46 },
  number: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** Animation durations (ms). */
export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

/** Minimum touch target (Apple HIG). */
export const touchTarget = 44;
