import Constants from 'expo-constants';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card, Logo, Screen, Text } from '@/components';
import { radius, spacing, ThemeProvider, useTheme } from '@/theme';

/** Phase 1 placeholder: both logos and a way into the design gallery. Replaced in Phase 3. */
export default function Index() {
  const { colors } = useTheme();
  const version = Constants.expoConfig?.version ?? '';
  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs, paddingTop: spacing.lg }}>
        <Text variant="largeTitle">SALFORD POS</Text>
        <Text variant="subhead" tone="secondary">
          النسخة الجديدة قيد الإنشاء · {version}
        </Text>
      </View>
      {(['jewelry', 'scarves'] as const).map((system) => (
        <ThemeProvider key={system} system={system}>
          <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <Logo system={system} width={170} />
          </Card>
        </ThemeProvider>
      ))}
      <Link href="/gallery" asChild>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => ({
            minHeight: 52,
            borderRadius: radius.full,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.75 : 1,
          })}>
          <Text variant="headline" tone="onAccent">
            معرض التصميم
          </Text>
        </Pressable>
      </Link>
    </Screen>
  );
}
