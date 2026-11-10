import { ListGroup, ListRow, Screen, Text } from '@/components';
import { spacing } from '@/theme';

/** The Management tab. Settings, backup, debts and expenses are added in later phases. */
export function ManagementScreen({
  onSwitch,
  onLock,
  onBrands,
}: {
  onSwitch: () => void;
  onLock: () => void;
  onBrands: () => void;
}) {
  return (
    <Screen tabBar contentStyle={{ gap: spacing.lg }}>
      <Text variant="largeTitle">الإدارة</Text>
      <ListGroup header="المخزون">
        <ListRow icon="seal" title="الماركات" onPress={onBrands} testID="manage-brands" />
      </ListGroup>
      <ListGroup header="النظام">
        <ListRow icon="arrow.left.arrow.right" title="تبديل النظام" onPress={onSwitch} />
        <ListRow icon="lock" title="قفل النظام" onPress={onLock} />
      </ListGroup>
    </Screen>
  );
}
