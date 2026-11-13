import type { SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Card, HeroCard, Icon, ListGroup, ListRow, Segmented, Stat, Text } from '@/components';
import { copyReminderTitle } from '@/backup/model';
import type { AlertKind, OwnerAlert } from '@/domain/alerts';
import { PAYMENT_LABELS } from '@/domain/checkout';
import { DailyChart } from '@/features/dashboard/daily-chart';
import { cashVsCredit, type DashboardData } from '@/features/dashboard/model';
import { RankedList } from '@/features/dashboard/ranked-list';
import { formatTime, monthTitle, type MonthKey } from '@/lib/dates';
import { formatDinars, formatLyd } from '@/lib/money';
import { spacing, useTheme, type SystemId } from '@/theme';

import { Grid, KpiTile, Title } from './layout';

/** What the home screen's cards and header can open. */
export type DashboardActions = {
  /** The logo: switch system or lock. */
  onSystemMenu: () => void;
  onEditRate: () => void;
  onMonth: (month: MonthKey) => void;
  onOpenSale: (id: number) => void;
  onOpenDebts: () => void;
  onOpenBackup: () => void;
  onOpenProducts: () => void;
  /** An alert (phase S6): what happened, open it, or mark it seen. */
  onOpenAlert: (alert: OwnerAlert) => void;
  /** The shortcuts at the top. */
  onNewSale: () => void;
  onNewReceipt: () => void;
  onNewProduct: () => void;
};

/** The cards of the home screen. */
export function TodayCard({ data, piece }: { data: DashboardData; piece: string }) {
  const money = cashVsCredit(data.today.byMethod);
  return (
    <HeroCard style={{ flex: 1 }}>
      <Text variant="subhead" tone="onAccent">
        مبيعات اليوم
      </Text>
      <Text variant="hero" tone="onAccent" testID="today-total">
        {formatLyd(data.today.total)}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Stat value={formatDinars(data.today.profit)} label="الربح" onAccent />
        <Stat value={String(data.today.sales)} label="فواتير" onAccent />
        <Stat value={String(data.today.pieces)} label={piece} onAccent />
      </View>
      <Text variant="caption" tone="onAccent" testID="today-cash-credit">
        {`مدفوع ${formatLyd(money.paid)} • ${PAYMENT_LABELS.credit} ${formatLyd(money.credit)}`}
      </Text>
    </HeroCard>
  );
}

/** The most alerts listed at once; the rest show as they are seen. */
const MAX_ALERTS = 5;

const ALERT_ICONS: Record<AlertKind, SymbolViewProps['name']> = {
  discounts: 'tag',
  approvals: 'checkmark.shield',
  quickReturn: 'arrow.uturn.backward.circle',
  wrongPins: 'lock.trianglebadge.exclamationmark',
  shortage: 'banknote',
  clock: 'clock.badge.exclamationmark',
  log: 'list.bullet.clipboard',
};

export function AttentionCard({
  data,
  actions,
}: {
  data: DashboardData;
  actions: DashboardActions;
}) {
  const a = data.attention;
  const alerts = a.alerts ?? [];
  const nothing =
    !a.lowCount &&
    !a.outCount &&
    !a.owed &&
    !a.backupReminder &&
    !a.dataProblem &&
    alerts.length === 0;
  return (
    <Card style={{ flex: 1 }} testID="attention">
      <Title>يحتاج انتباهك</Title>
      {nothing ? (
        <Text variant="subhead" tone="secondary">
          لا شيء الآن: المخزون والديون والنسخ الاحتياطي بخير.
        </Text>
      ) : (
        <ListGroup>
          {a.backupReminder ? (
            // First and in red: losing the device loses everything since the last copy off it.
            <ListRow
              icon="externaldrive.badge.exclamationmark"
              title={copyReminderTitle(a.backupReminder.days)}
              subtitle={a.backupReminder.text}
              tone="danger"
              onPress={actions.onOpenBackup}
              testID="attention-backup"
            />
          ) : null}
          {alerts.slice(0, MAX_ALERTS).map((alert) => (
            <ListRow
              key={alert.key}
              icon={ALERT_ICONS[alert.kind]}
              tone="warning"
              title={alert.title}
              subtitle={alert.detail}
              onPress={() => actions.onOpenAlert(alert)}
              testID={`alert-${alert.kind}`}
            />
          ))}
          {alerts.length > MAX_ALERTS ? (
            <ListRow
              icon="bell.badge"
              title={`${alerts.length - MAX_ALERTS} تنبيهات أخرى`}
              subtitle="اطلع على المعروض أولاً ليظهر الباقي"
              testID="alert-more"
            />
          ) : null}
          {a.dataProblem ? (
            <ListRow
              icon="exclamationmark.octagon"
              tone="warning"
              title="فحص البيانات وجد مشكلة"
              subtitle="افتح النسخ الاحتياطي واحفظ نسخة الآن، واحتفظ بآخر نسخة سليمة."
              onPress={actions.onOpenBackup}
              testID="attention-data"
            />
          ) : null}
          {a.outCount || a.lowCount ? (
            <ListRow
              icon="exclamationmark.triangle"
              tone="warning"
              title={`نفد ${a.outCount} • قارب على النفاد ${a.lowCount}`}
              subtitle={a.low
                .map((p) => `${p.name}${p.size ? ` ${p.size}` : ''} (${p.stock})`)
                .join('، ')}
              onPress={actions.onOpenProducts}
              testID="attention-stock"
            />
          ) : null}
          {a.owed ? (
            <ListRow
              icon="person.crop.circle.badge.exclamationmark"
              title="ديون الزبائن"
              subtitle={`${a.debtors} زبون`}
              value={formatLyd(a.owed)}
              tone="warning"
              onPress={actions.onOpenDebts}
              testID="attention-debts"
            />
          ) : null}
        </ListGroup>
      )}
    </Card>
  );
}

/** ‹ نوفمبر 2026 ›: the previous month on the leading side, as time runs in Arabic. */
export function EmptyMonth({ data }: { data: DashboardData }) {
  const { colors } = useTheme();
  const s = data.summary;
  return (
    <Card
      style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}
      testID="empty-month">
      <Icon name="chart.bar" size={28} color={colors.accent} />
      <Text variant="headline" center>
        {`لا مبيعات في ${monthTitle(data.month)}`}
      </Text>
      {s.expenses ? (
        <Text variant="subhead" tone="secondary" center>
          {`المصروفات ${formatLyd(s.expenses)} • صافي الربح ${formatLyd(s.netProfit)}`}
        </Text>
      ) : (
        <Text variant="subhead" tone="secondary" center>
          تظهر هنا أرقام الشهر ورسمه عند أول بيعة.
        </Text>
      )}
    </Card>
  );
}

export function ChartCard({ data }: { data: DashboardData }) {
  return (
    <Card style={{ flex: 1, gap: spacing.ms }}>
      <Title>المبيعات اليومية</Title>
      <DailyChart month={data.month} days={data.daily} />
    </Card>
  );
}

export type BreakdownKind = 'category' | 'brand' | 'size' | 'payment' | 'seller' | 'top';

/** The month by category, brand, size (scarves), payment or best sellers: one card, one switch. */
export function BreakdownCard({
  system,
  data,
  piece,
}: {
  system: SystemId;
  data: DashboardData;
  piece: string;
}) {
  const [kind, setKind] = useState<BreakdownKind>('category');
  const options: { value: BreakdownKind; label: string }[] = [
    { value: 'category', label: system === 'scarves' ? 'الخامة' : 'الصنف' },
    { value: 'brand', label: 'الماركة' },
    ...(system === 'scarves' ? [{ value: 'size' as const, label: 'المقاس' }] : []),
    { value: 'payment', label: 'الدفع' },
    // Sales per person, once employees have sold something (phase S3).
    ...(data.bySeller.some((r) => r.key !== 'المالك')
      ? [{ value: 'seller' as const, label: 'البائع' }]
      : []),
    { value: 'top', label: 'الأكثر' },
  ];
  return (
    <Card style={{ flex: 1, gap: spacing.ms }}>
      <Title>{`حسب ${options.find((o) => o.value === kind)?.label ?? ''}`}</Title>
      <Segmented options={options} value={kind} onChange={setKind} testID="breakdown-kind" />
      {kind === 'category' ? (
        <RankedList rows={data.byCategory} unit={piece} testID="by-category" />
      ) : kind === 'brand' ? (
        <RankedList rows={data.byBrand} unit={piece} testID="by-brand" />
      ) : kind === 'size' ? (
        <RankedList
          rows={data.bySize}
          unit={piece}
          extra={(r) => (r.stock !== undefined ? `في المخزون ${r.stock}` : null)}
          testID="by-size"
        />
      ) : kind === 'payment' ? (
        <RankedList rows={data.byPayment} unit={piece} testID="by-payment" />
      ) : kind === 'seller' ? (
        <RankedList rows={data.bySeller} unit={piece} testID="by-seller" />
      ) : (
        <RankedList rows={data.top} unit={piece} testID="top-products" />
      )}
    </Card>
  );
}

export function LatestCard({
  data,
  onOpenSale,
}: {
  data: Pick<DashboardData, 'latest'>;
  onOpenSale: (id: number) => void;
}) {
  return (
    <Card style={{ flex: 1 }} testID="latest-sales">
      <Title>آخر المبيعات</Title>
      {data.latest.length === 0 ? (
        <Text variant="subhead" tone="secondary">
          لا مبيعات بعد.
        </Text>
      ) : (
        <ListGroup>
          {data.latest.map((s) => (
            <ListRow
              key={s.id}
              title={s.lines.map((l) => l.name).join('، ')}
              subtitle={`${formatTime(new Date(s.createdAt))} • ${PAYMENT_LABELS[s.paymentMethod]}${s.customerName ? ` • ${s.customerName}` : ''}`}
              value={formatLyd(s.total)}
              onPress={() => onOpenSale(s.id)}
              testID={`latest-${s.id}`}
            />
          ))}
        </ListGroup>
      )}
    </Card>
  );
}

/** The stock now, as four tiles (2 × 2 on iPhone); the first opens the products. */
export function StockTiles({
  data,
  piece,
  wide,
  onOpen,
}: {
  data: DashboardData;
  piece: string;
  wide: boolean;
  onOpen: () => void;
}) {
  const s = data.stock;
  return (
    <View style={{ gap: spacing.sm }} testID="stock-summary">
      <Text variant="title">المخزون</Text>
      <Grid columns={wide ? 4 : 2}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`في المخزون ${s.pieces} ${piece}، فتح المنتجات`}
          style={{ flex: 1 }}>
          <KpiTile label="في المخزون" value={`${s.pieces} ${piece}`} />
        </Pressable>
        <KpiTile label="الأصناف" value={String(s.items)} />
        <KpiTile label="القيمة بالتكلفة" value={formatLyd(s.costValue)} />
        <KpiTile label="القيمة بسعر البيع" value={formatLyd(s.priceValue)} />
      </Grid>
    </View>
  );
}
