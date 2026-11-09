/**
 * The font files the app loads at start-up, keyed by the family names in `fonts` (tokens.ts).
 * Each weight is imported on its own so only these ten files are bundled.
 */
import { CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond/500Medium';
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond/500Medium_Italic';
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold';
import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic/400Regular';
import { IBMPlexSansArabic_500Medium } from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import { IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold';
import { IBMPlexSansArabic_700Bold } from '@expo-google-fonts/ibm-plex-sans-arabic/700Bold';
import { PlayfairDisplay_500Medium } from '@expo-google-fonts/playfair-display/500Medium';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display/600SemiBold';
import { PlayfairDisplay_800ExtraBold } from '@expo-google-fonts/playfair-display/800ExtraBold';

import { fonts } from './tokens';

export const fontAssets = {
  [fonts.regular]: IBMPlexSansArabic_400Regular,
  [fonts.medium]: IBMPlexSansArabic_500Medium,
  [fonts.semibold]: IBMPlexSansArabic_600SemiBold,
  [fonts.bold]: IBMPlexSansArabic_700Bold,
  [fonts.logoJewelry]: PlayfairDisplay_800ExtraBold,
  [fonts.logoJewelryText]: PlayfairDisplay_600SemiBold,
  [fonts.logoJewelryLight]: PlayfairDisplay_500Medium,
  [fonts.logoScarves]: CormorantGaramond_600SemiBold,
  [fonts.logoScarvesText]: CormorantGaramond_500Medium,
  [fonts.logoScarvesItalic]: CormorantGaramond_500Medium_Italic,
};
