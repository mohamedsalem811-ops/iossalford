import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { ThemeProvider } from '@/theme';
import { fontAssets } from '@/theme/font-assets';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const [loaded, error] = useFonts(fontAssets);

  useEffect(() => {
    // If a font file fails to load, continue with the system font rather than stay on the splash.
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <NavigationTheme value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ThemeProvider system={null}>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </NavigationTheme>
  );
}
