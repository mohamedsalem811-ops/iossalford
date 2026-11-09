import { View } from 'react-native';

import { Screen, SystemCard, Text } from '@/components';
import { spacing, type SystemId } from '@/theme';

/** The start screen: the two systems as large cards. The one used last has the stronger edge. */
export function ChooserScreen({
  last,
  version,
  onChoose,
}: {
  last: SystemId | null;
  version: string;
  onChoose: (system: SystemId) => void;
}) {
  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs, paddingTop: spacing.lg }}>
        <Text variant="largeTitle">SALFORD POS</Text>
        <Text variant="subhead" tone="secondary">
          اختر النظام
        </Text>
      </View>
      <SystemCard
        system="jewelry"
        selected={last === 'jewelry'}
        onPress={() => onChoose('jewelry')}
      />
      <SystemCard
        system="scarves"
        selected={last === 'scarves'}
        onPress={() => onChoose('scarves')}
      />
      {version ? (
        <Text variant="caption" tone="secondary" center>
          {`الإصدار ${version}`}
        </Text>
      ) : null}
    </Screen>
  );
}
