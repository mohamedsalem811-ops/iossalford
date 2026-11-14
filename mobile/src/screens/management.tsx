import type { SymbolViewProps } from 'expo-symbols';

import { Pressable } from 'react-native';

import { Button, Card, ListGroup, ListRow, Screen, Text } from '@/components';
import { spacing } from '@/theme';

/** The management screens, each opened by its route (see the More tab). */
export type ManageTarget =
  | 'shift'
  | 'shifts'
  | 'daySummary'
  | 'sales'
  | 'returns'
  | 'returnFind'
  | 'policies'
  | 'customers'
  | 'debts'
  | 'expenses'
  | 'closing'
  | 'comparison'
  | 'brands'
  | 'sets'
  | 'archived'
  | 'backup'
  | 'staff'
  | 'log'
  | 'stockCount'
  | 'deviceGuide'
  | 'settings';

type Row = { target: ManageTarget; icon: SymbolViewProps['name']; title: string };

/** The hub, grouped as in the plan: sales, customers, money, catalogue, app. */
export const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'المبيعات',
    rows: [
      { target: 'shift', icon: 'clock.badge.checkmark', title: 'الوردية' },
      { target: 'sales', icon: 'list.bullet.rectangle', title: 'سجل المبيعات' },
      { target: 'returnFind', icon: 'arrow.left.arrow.right.circle', title: 'مرتجع أو استبدال' },
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
      { target: 'daySummary', icon: 'calendar', title: 'ملخص اليوم' },
      { target: 'shifts', icon: 'tray.full', title: 'الورديات وعدّ النقد' },
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
      { target: 'archived', icon: 'archivebox', title: 'القطع المؤرشفة' },
      { target: 'stockCount', icon: 'list.number', title: 'جرد المخزون' },
    ],
  },
  {
    title: 'التطبيق',
    rows: [
      { target: 'backup', icon: 'externaldrive', title: 'النسخ الاحتياطي' },
      { target: 'staff', icon: 'person.2.badge.gearshape', title: 'الموظفون' },
      { target: 'policies', icon: 'checklist', title: 'قواعد البيع والمرتجعات' },
      { target: 'log', icon: 'list.bullet.clipboard', title: 'سجل النشاط' },
      { target: 'deviceGuide', icon: 'lock.shield', title: 'حماية الأجهزة' },
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
  selected,
  hidden = [],
  person,
  clockBehind,
  onAcceptClock,
  logBroken = false,
  setup,
  warn = [],
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
  /** iPad: the section open beside the menu. */
  selected?: ManageTarget;
  /** Sections this person may not open (an employee: the owner's sections). */
  hidden?: ManageTarget[];
  /** Who is signed in, when the shop has employees ("المالك", a name). */
  person?: string;
  /** The device clock went back (phase S3): why changes are refused. */
  clockBehind?: string | null;
  /** The owner accepts the device's time (absent: not the owner). */
  onAcceptClock?: () => void;
  /** The activity log was changed outside the app: a banner that opens it. */
  logBroken?: boolean;
  /** The owner's settings still to do (H2): a banner that opens them. */
  setup?: { count: number; onOpen: () => void };
  /** Rows whose value draws attention (الإعدادات while something needs setting up). */
  warn?: ManageTarget[];
}) {
  return (
    <Screen tabBar contentStyle={{ gap: spacing.lg }}>
      <Text variant="largeTitle">الإدارة</Text>
      {clockBehind ? (
        <Card testID="manage-clock-behind">
          <Text variant="bodyStrong" tone="warning">
            ساعة الجهاز رجعت للخلف
          </Text>
          <Text variant="caption" tone="secondary">
            {clockBehind}
          </Text>
          {onAcceptClock ? (
            <Button
              title="قبول وقت الجهاز"
              variant="secondary"
              onPress={onAcceptClock}
              testID="manage-accept-clock"
            />
          ) : null}
        </Card>
      ) : null}
      {logBroken ? (
        <Pressable
          onPress={() => onOpen('log')}
          accessibilityRole="button"
          testID="manage-log-broken">
          <Card>
            <Text variant="bodyStrong" tone="warning">
              تغيّر سجل النشاط خارج التطبيق
            </Text>
            <Text variant="caption" tone="accent">
              فتح سجل النشاط
            </Text>
          </Card>
        </Pressable>
      ) : null}
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
      {setup && setup.count > 0 ? (
        <Pressable onPress={setup.onOpen} accessibilityRole="button" testID="manage-setup">
          <Card>
            <Text variant="bodyStrong" tone="warning">
              {`إعدادات تحتاج إكمالاً (${setup.count})`}
            </Text>
            <Text variant="caption" tone="accent">
              فتح الولاء والمكافآت
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
      {GROUPS.map((g) => ({ ...g, rows: g.rows.filter((r) => !hidden.includes(r.target)) }))
        // A group whose sections are all hidden (an employee) is left out, header and all.
        .filter((g) => g.rows.length > 0)
        .map((g) => (
          <ListGroup key={g.title} header={g.title}>
            {g.rows.map((r) => (
              <ListRow
                key={r.target}
                icon={r.icon}
                title={r.title}
                value={badges[r.target]}
                tone={warn.includes(r.target) ? 'warning' : undefined}
                selected={selected === r.target}
                onPress={() => onOpen(r.target)}
                testID={`manage-${r.target}`}
              />
            ))}
          </ListGroup>
        ))}
      <ListGroup header="النظام">
        <ListRow
          icon="arrow.left.arrow.right"
          title="تبديل النظام"
          onPress={onSwitch}
          testID="manage-switch"
        />
        <ListRow
          icon="lock"
          title={person ? 'تبديل المستخدم أو القفل' : 'قفل النظام'}
          subtitle={person ? `مسجّل الدخول: ${person}` : undefined}
          onPress={onLock}
          testID="manage-lock"
        />
      </ListGroup>
    </Screen>
  );
}
