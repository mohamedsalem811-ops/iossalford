import Constants from 'expo-constants';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, SystemCard, Text } from '@/components';
import { spacing } from '@/theme';

/** Phase 1 placeholder: the two system cards and a way into the design gallery. Replaced in Phase 3. */
export default function Index() {
  const version = Constants.expoConfig?.version ?? '';
  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs, paddingTop: spacing.lg }}>
        <Text variant="largeTitle">SALFORD POS</Text>
        <Text variant="subhead" tone="secondary">
          النسخة الجديدة قيد الإنشاء · {version}
        </Text>
      </View>
      <SystemCard system="jewelry" selected onPress={() => router.push('/gallery')} />
      <SystemCard system="scarves" onPress={() => router.push('/gallery')} />
      <Button
        title="معرض التصميم"
        icon="paintpalette"
        size="lg"
        fullWidth
        onPress={() => router.push('/gallery')}
      />
    </Screen>
  );
}
