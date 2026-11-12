import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { logError } from '@/lib/error-log';
import { spacing } from '@/theme';

import { Button } from './button';
import { EmptyState } from './section';

/**
 * Shown instead of a screen that hit an unexpected error, so one bug never closes the app: the
 * tab bar and the other screens keep working. The error is written to the log on the device
 * (Settings → سجل الأخطاء). Data is safe: every change is saved all-or-nothing.
 */
export function ErrorScreen({ error, retry, where }: ErrorBoundaryProps & { where: string }) {
  useEffect(() => {
    logError(where, error);
  }, [where, error]);
  return (
    <View
      style={{ flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md }}
      testID="error-screen">
      <EmptyState
        icon="exclamationmark.triangle"
        title="حدث خطأ في هذه الشاشة"
        message="بياناتك سليمة: لا يُحفظ أي تغيير ناقص. حاول مجدداً، وإن تكرر الخطأ أرسل سجل الأخطاء من الإعدادات."
      />
      <Button
        title="حاول مجدداً"
        icon="arrow.clockwise"
        onPress={() => void retry()}
        testID="error-retry"
      />
    </View>
  );
}

/** An error boundary for a route file: `export const ErrorBoundary = errorBoundary('المبيعات');` */
export const errorBoundary = (where: string) =>
  function RouteErrorBoundary(props: ErrorBoundaryProps) {
    return <ErrorScreen {...props} where={where} />;
  };
