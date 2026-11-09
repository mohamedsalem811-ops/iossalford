import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, type SystemId } from '@/theme';

/**
 * Renders a screen inside a safe area (an iPhone 16 frame) and a system's light theme. The
 * wrapper stays in place on `rerender`.
 */
export function renderScreen(ui: ReactElement, system: SystemId | null = 'jewelry') {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ThemeProvider system={system} appearance="light">
          {children}
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
