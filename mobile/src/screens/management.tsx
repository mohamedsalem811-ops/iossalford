import type { SymbolViewProps } from 'expo-symbols';

import { ListGroup, ListRow, Screen, Text } from '@/components';
import { spacing } from '@/theme';

/** The management screens, each opened by its route (see the More tab). */
export type ManageTarget = 'sales' | 'returns' | 'brands' | 'sets' | 'settings';

type Row = { target: ManageTarget; icon: SymbolViewProps['name']; title: string };

/** The hub, grouped as in the plan: sales, customers, money, catalogue, app. */
export const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'المبيعات',
    rows: [
      { target: 'sales', icon: 'list.bullet.rectangle', title: 'سجل المبيعات' },
      { target: 'returns', icon: 'arrow.uturn.backward', title: 'المرتجعات' },
    ],
  },
  {
    title: 'الكتالوج',
    rows: [
      { target: 'brands', icon: 'seal', title: 'الماركات' },
      { target: 'sets', icon: 'square.stack.3d.up', title: 'الأطقم' },
    ],
  },
  {
    title: 'التطبيق',
    rows: [{ target: 'settings', icon: 'gearshape', title: 'الإعدادات' }],
  },
];

/** The Management tab: every management screen by group, then switching and locking. */
export function ManagementScreen({
  onOpen,
  onSwitch,
  onLock,
  badges = {},
}: {
  onOpen: (target: ManageTarget) => void;
  onSwitch: () => void;
  onLock: () => void;
  /** A value shown at the end of a row (a count, a total). */
  badges?: Partial<Record<ManageTarget, string>>;
}) {
  return (
    <Screen tabBar contentStyle={{ gap: spacing.lg }}>
      <Text variant="largeTitle">الإدارة</Text>
      {GROUPS.map((g) => (
        <ListGroup key={g.title} header={g.title}>
          {g.rows.map((r) => (
            <ListRow
              key={r.target}
              icon={r.icon}
              title={r.title}
              value={badges[r.target]}
              onPress={() => onOpen(r.target)}
              testID={`manage-${r.target}`}
            />
          ))}
        </ListGroup>
      ))}
      <ListGroup header="النظام">
        <ListRow icon="arrow.left.arrow.right" title="تبديل النظام" onPress={onSwitch} />
        <ListRow icon="lock" title="قفل النظام" onPress={onLock} />
      </ListGroup>
    </Screen>
  );
}
