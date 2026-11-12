import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { KeyboardBar } from '@/components/keyboard-bar';
import { PrivacyCover } from '@/components/privacy-cover';
import { excludeAppDataFromBackup } from '@/backup/exclusion';
import { installGlobalErrorLog, logError } from '@/lib/error-log';
import { installKeyCommands } from '@/lib/key-commands';
import { moveLegacyData } from '@/lib/storage';
import { applySavedAppearance } from '@/state/appearance';
import { LockProvider } from '@/state/lock';
import { ThemeProvider } from '@/theme';
import { fontAssets } from '@/theme/font-assets';
import { errorBoundary } from '@/components/error-screen';

// Unexpected errors are written to the log on the device (Settings → سجل الأخطاء).
installGlobalErrorLog();
SplashScreen.preventAutoHideAsync();
// The owner's light/dark choice (Settings) applies before anything is drawn.
applySavedAppearance();
// Databases and photos live in the app's private folder (older installs are moved there once),
// before any database opens.
const moved = moveLegacyData(['jewelry', 'scarves']);
if (moved.leftBehind > 0)
  logError('نقل البيانات إلى المجلد الخاص', new Error(`${moved.leftBehind} ملف لم يُنقل بعد`));
// The shop's data stays on this device: out of the device's iCloud backup (installed app only).
excludeAppDataFromBackup();

export default function RootLayout() {
  const scheme = useColorScheme();
  const [loaded, error] = useFonts(fontAssets);

  useEffect(() => {
    // If a font file fails to load, continue with the system font rather than stay on the splash.
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // iPad keyboard shortcuts (⌘F, ⌘N), once the window exists.
  useEffect(installKeyCommands, []);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('app');
