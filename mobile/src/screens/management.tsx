import type { SymbolViewProps } from 'expo-symbols';

import { Pressable } from 'react-native';

import { Card, ListGroup, ListRow, Screen, Text } from '@/components';
import { spacing } from '@/theme';

/** The management screens, each opened by its route (see the More tab). */
export type ManageTarget =
  | 'sales'
  | 'returns'
  | 'customers'
  | 'debts'
  | 'expenses'
  | 'closing'
  | 'comparison'
  | 'brands'
  | 'sets'
  | 'backup'
  | 'settings';

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
    title: 'الزبائن',
    rows: [
      { target: 'customers', icon: 'person.2', title: 'الزبائن' },
      { target: 'debts', icon: 'creditcard', title: 'الديون' },
    ],
  },
  {
    title: 'المال',
    rows: [
      { target: 'expenses', icon: 'banknote', title: 'المصروفات' },
      { target: 'closing', icon: 'checkmark.seal', title: 'الإقفال الربع سنوي' },
      { target: 'comparison', icon: 'chart.bar', title: 'مقارنة الأشهر' },
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
    rows: [
      { target: 'backup', icon: 'externaldrive', title: 'النسخ الاحتياطي' },
      { target: 'settings', icon: 'gearshape', title: 'الإعدادات' },
    ],
  },
];

/** The Management tab: every management screen by group, then switching and locking. */
export function ManagementScreen({
  onOpen,
  onSwitch,
  onLock,
  badges = {},
  reminder,
  updateReady = false,
}: {
  onOpen: (target: ManageTarget) => void;
  onSwitch: () => void;
  onLock: () => void;
  /** A value shown at the end of a row (a count, a total). */
  badges?: Partial<Record<ManageTarget, string>>;
  /** No recent backup copied off the device: a banner that opens the backup screen. */
  reminder?: string | null;
  /** An instant update was downloaded: a banner that opens Settings to restart. */
  updateReady?: boolean;
}) {
  return (
    <Screen tabBar contentStyle={{ gap: spacing.lg }}>
      <Text variant="largeTitle">الإدارة</Text>
      {reminder ? (
        <Pressable
          onPress={() => onOpen('backup')}
          accessibilityRole="button"
          testID="manage-backup-reminder">
          <Card>
            <Text variant="bodyStrong" tone="warning">
              {reminder}
            </Text>
            <Text variant="caption" tone="accent">
              فتح النسخ الاحتياطي
            </Text>
          </Card>
        </Pressable>
      ) : null}
      {updateReady ? (
        <Pressable
          onPress={() => onOpen('settings')}
          accessibilityRole="button"
          testID="manage-update-ready">
          <Card>
            <Text variant="bodyStrong">تحديث جاهز للتطبيق</Text>
            <Text variant="caption" tone="accent">
              يعمل عند الفتح القادم، أو أعد التشغيل من الإعدادات
            </Text>
          </Card>
        </Pressable>
      ) : null}
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
