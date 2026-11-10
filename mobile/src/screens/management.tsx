import { ListGroup, ListRow, Screen, Text } from '@/components';
import { spacing } from '@/theme';

/** The Management tab. Settings, backup, debts and expenses are added in later phases. */
export function ManagementScreen({
  onSwitch,
  onLock,
  onBrands,
  onSets,
}: {
  onSwitch: () => void;
  onLock: () => void;
  onBrands: () => void;
  onSets: () => void;
}) {
  return (
    <Screen tabBar contentStyle={{ gap: spacing.lg }}>
      <Text variant="largeTitle">الإدارة</Text>
      <ListGroup header="المخزون">
        <ListRow icon="seal" title="الماركات" onPress={onBrands} testID="manage-brands" />
        <ListRow icon="square.stack.3d.up" title="الأطقم" onPress={onSets} testID="manage-sets" />
      </ListGroup>
      <ListGroup header="النظام">
        <ListRow icon="arrow.left.arrow.right" title="تبديل النظام" onPress={onSwitch} />
        <ListRow icon="lock" title="قفل النظام" onPress={onLock} />
      </ListGroup>
    </Screen>
  );
}
