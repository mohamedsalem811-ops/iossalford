import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { neutral, palettes, type Mode, type Palette, type SystemId } from './palette';

/** "system" follows the device; the owner can pin light or dark in Settings (Phase 7). */
export type Appearance = 'system' | 'light' | 'dark';

export type Theme = {
  system: SystemId | null;
  mode: Mode;
  colors: Palette;
};

const ThemeContext = createContext<Theme | null>(null);

export function resolveTheme(system: SystemId | null, mode: Mode): Theme {
  return { system, mode, colors: system ? palettes[system][mode] : neutral[mode] };
}

export function ThemeProvider({
  system,
  appearance = 'system',
  children,
}: {
  system: SystemId | null;
  appearance?: Appearance;
  children: ReactNode;
}) {
  const scheme = useColorScheme();
  const mode: Mode = appearance === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : appearance;
  const theme = useMemo(() => resolveTheme(system, mode), [system, mode]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** The active system's palette in the current mode. Falls back to the neutral palette. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const theme = useContext(ThemeContext);
  return theme ?? resolveTheme(null, scheme === 'dark' ? 'dark' : 'light');
}
