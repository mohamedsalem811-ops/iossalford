import { ListGroup, ListRow, Screen, Text } from '@/components';
import { spacing } from '@/theme';

/** The Management tab. Settings, backup, debts and expenses are added in later phases. */
export function ManagementScreen({
  onSwitch,
  onLock,
}: {
  onSwitch: () => void;
  onLock: () => void;
}) {
  return (
    <Screen tabBar contentStyle={{ gap: spacing.lg }}>
      <Text variant="largeTitle">الإدارة</Text>
      <ListGroup header="النظام">
        <ListRow icon="arrow.left.arrow.right" title="تبديل النظام" onPress={onSwitch} />
        <ListRow icon="lock" title="قفل النظام" onPress={onLock} />
      </ListGroup>
    </Screen>
  );
}
