import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { KeyboardBar } from '@/components/keyboard-bar';
import { PrivacyCover } from '@/components/privacy-cover';
import { LockProvider } from '@/state/lock';
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
    <KeyboardProvider>
      <NavigationTheme value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <ThemeProvider system={null}>
          <LockProvider>
            <Stack screenOptions={{ headerShown: false }}>
              {/* Back to the start screen locks the system; no slide, so the login never shows. */}
              <Stack.Screen name="index" options={{ animation: 'none' }} />
            </Stack>
            <KeyboardBar />
            <PrivacyCover />
          </LockProvider>
        </ThemeProvider>
      </NavigationTheme>
    </KeyboardProvider>
  );
}
