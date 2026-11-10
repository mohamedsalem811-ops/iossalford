/**
 * Colour palettes from the approved design (docs/DESIGN.md, "Mix B + C").
 * One palette per system and mode. Screens never use hex values directly — they read these
 * through useTheme().
 */

export type SystemId = 'jewelry' | 'scarves';
export type Mode = 'light' | 'dark';

export type Palette = {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  /** Translucent fill for chips on top of the accent hero card. */
  onAccentChip: string;
  separator: string;
  chevron: string;
  segmentTrack: string;
  segmentThumb: string;
  warning: string;
  /** Glass tab bar fill and edge. */
  glass: string;
  glassEdge: string;
  /** Card shadow (boxShadow string), "none" in dark mode. */
  cardShadow: string;
  floatingShadow: string;
};

export const palettes: Record<SystemId, Record<Mode, Palette>> = {
  jewelry: {
    light: {
      background: '#F2F2F5',
      surface: '#FFFFFF',
      text: '#111114',
      textSecondary: '#6C6C74',
      accent: '#3A43A0',
      accentSoft: '#E7E8F7',
      onAccent: '#FFFFFF',
      onAccentChip: 'rgba(255,255,255,0.18)',
      separator: '#ECECF0',
      chevron: '#C7C7CC',
      segmentTrack: '#E3E3E8',
      segmentThumb: '#FFFFFF',
      warning: '#C2410C',
      glass: 'rgba(255,255,255,0.75)',
      glassEdge: 'rgba(255,255,255,0.95)',
      cardShadow: '0 6px 18px rgba(18,20,46,0.06)',
      floatingShadow: '0 10px 30px rgba(18,20,46,0.14)',
    },
    dark: {
      background: '#000000',
      surface: '#1C1C1E',
      text: '#F5F5F7',
      textSecondary: '#98989F',
      accent: '#A9B0FF',
      accentSoft: '#272A52',
      onAccent: '#0B0C22',
      onAccentChip: 'rgba(11,12,34,0.14)',
      separator: '#2C2C2E',
      chevron: '#48484A',
      segmentTrack: '#1C1C1E',
      segmentThumb: '#3A3A3C',
      warning: '#FF9F6B',
      glass: 'rgba(44,44,46,0.75)',
      glassEdge: 'rgba(255,255,255,0.12)',
      cardShadow: 'none',
      floatingShadow: '0 10px 30px rgba(0,0,0,0.5)',
    },
  },
  scarves: {
    light: {
      background: '#F3F1EC',
      surface: '#FFFFFF',
      text: '#14120E',
      textSecondary: '#716B5C',
      accent: '#806229',
      accentSoft: '#F2E9D6',
      onAccent: '#FFFFFF',
      onAccentChip: 'rgba(255,255,255,0.18)',
      separator: '#EEEBE4',
      chevron: '#C9C5BB',
      segmentTrack: '#E5E3DD',
      segmentThumb: '#FFFFFF',
      warning: '#C2410C',
      glass: 'rgba(255,255,255,0.75)',
      glassEdge: 'rgba(255,255,255,0.95)',
      cardShadow: '0 6px 18px rgba(30,26,19,0.06)',
      floatingShadow: '0 10px 30px rgba(30,26,19,0.14)',
    },
    dark: {
      background: '#000000',
      surface: '#1C1C1E',
      text: '#F5F3EE',
      textSecondary: '#A19B8C',
      accent: '#D9B977',
      accentSoft: '#3A3221',
      onAccent: '#14120E',
      onAccentChip: 'rgba(20,18,14,0.14)',
      separator: '#2C2C2E',
      chevron: '#48484A',
      segmentTrack: '#1C1C1E',
      segmentThumb: '#3A3A3C',
      warning: '#FF9F6B',
      glass: 'rgba(44,44,46,0.75)',
      glassEdge: 'rgba(255,255,255,0.12)',
      cardShadow: 'none',
      floatingShadow: '0 10px 30px rgba(0,0,0,0.5)',
    },
  },
};

/** Neutral palette for screens that belong to no system yet (the system chooser). */
export const neutral: Record<Mode, Palette> = {
  light: { ...palettes.jewelry.light, background: '#F2F2F5' },
  dark: { ...palettes.jewelry.dark },
};

/**
 * Brand badges: the built-in look of the main brands (original lettering in the brand's colours,
 * not their logo files) and the colours an initials badge picks from, by brand name.
 */
export const brandBadge = {
  builtIn: [
    {
      match: 'swarovski',
      background: '#000000',
      text: '#FFFFFF',
      label: 'SWAROVSKI',
      serif: false,
    },
    { match: 'tiffany', background: '#81D8D0', text: '#000000', label: 'T&Co.', serif: true },
    { match: 'pandora', background: '#FFFFFF', text: '#000000', label: 'PANDORA', serif: true },
  ],
  initials: [
    '#5856D6',
    '#30B0C7',
    '#FF9500',
    '#FF2D55',
    '#AF52DE',
    '#A2845E',
    '#00C7BE',
    '#32ADE6',
    '#FF3B30',
    '#007AFF',
  ],
  initialsText: '#FFFFFF',
  edge: 'rgba(0,0,0,0.12)',
} as const;
