import { Children, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import {
  Card,
  HeroCard,
  Icon,
  ListGroup,
  ListRow,
  Logo,
  Screen,
  Segmented,
  Stat,
  Text,
} from '@/components';
import { PAYMENT_LABELS } from '@/domain/checkout';
import { AppleDailyChart } from '@/features/dashboard/apple-chart';
import { DailyChart } from '@/features/dashboard/daily-chart';
import { cashVsCredit, type DashboardData } from '@/features/dashboard/model';
import { RankedList } from '@/features/dashboard/ranked-list';
import { useLayout } from '@/hooks/use-layout';
import { formatDay, formatTime, monthTitle, type MonthKey } from '@/lib/dates';
import { formatDinars, formatLyd, formatRate, formatUsd } from '@/lib/money';
import { radius, spacing, useTheme, type SystemId } from '@/theme';

export type DashboardActions = {
  /** The logo: switch system or lock. */
  onSystemMenu: () => void;
  onEditRate: () => void;
  onMonth: (month: MonthKey) => void;
  onOpenSale: (id: number) => void;
  onOpenDebts: () => void;
  onOpenBackup: () => void;
  onOpenProducts: () => void;
};

/**
 * The first tab. iPhone: one column. iPad: two or three columns of cards using the whole width
 * (Split View narrows it back to one).
 */
export function DashboardScreen({
  system,
  data,
  actions,
}: {
  system: SystemId;
  data: DashboardData;
  actions: DashboardActions;
}) {
  const { dashboardColumns: columns } = useLayout();
  const piece = system === 'scarves' ? 'وشاح' : 'قطعة';
  return (
    <Screen tabBar maxWidth={1400} contentStyle={{ gap: spacing.lg }}>
      <Header system={system} data={data} actions={actions} />
      <Grid columns={Math.min(columns, 2)}>
        <TodayCard data={data} piece={piece} />
        <AttentionCard data={data} actions={actions} />
      </Grid>
      <MonthPicker month={data.month} months={data.months} onMonth={actions.onMonth} />
      <Grid columns={Math.min(columns, 2)}>
        <MonthCard data={data} />
        <ChartCard data={data} />
      </Grid>
      <Grid columns={columns}>
        <Card>
          <Title>{system === 'scarves' ? 'حسب الخامة' : 'حسب الصنف'}</Title>
          <RankedList rows={data.byCategory} unit={piece} testID="by-category" />
        </Card>
        <Card>
          <Title>حسب العلامة التجارية</Title>
          <RankedList rows={data.byBrand} unit={piece} testID="by-brand" />
        </Card>
        {system === 'scarves' ? (
          <Card>
            <Title>حسب المقاس</Title>
            <RankedList
              rows={data.bySize}
              unit={piece}
              extra={(r) => (r.stock !== undefined ? `في المخزون ${r.stock}` : null)}
              testID="by-size"
            />
          </Card>
        ) : null}
        <Card>
          <Title>حسب طريقة الدفع</Title>
          <RankedList rows={data.byPayment} unit={piece} testID="by-payment" />
        </Card>
        <Card>
          <Title>الأكثر مبيعاً</Title>
          <RankedList rows={data.top} unit={piece} testID="top-products" />
        </Card>
        <LatestCard data={data} onOpenSale={actions.onOpenSale} />
        <StockCard data={data} piece={piece} onOpen={actions.onOpenProducts} />
      </Grid>
    </Screen>
  );
}

function Title({ children }: { children: string }) {
  return (
    <Text variant="headline" style={{ marginBottom: spacing.xs }}>
      {children}
    </Text>
  );
}

/** Lays cards out in rows of `columns`, each the same width (one column: full width). */
function Grid({ columns, children }: { columns: number; children: ReactNode }) {
  const [width, setWidth] = useState(0);
  const items = Children.toArray(children).filter(Boolean);
  const gap = spacing.md;
  const cell = columns > 1 && width > 0 ? (width - gap * (columns - 1)) / columns : undefined;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: 'stretch' }}>
      {items.map((child, i) => (
        <View key={i} style={cell ? { width: cell } : { width: '100%' }}>
          {child}
        </View>
      ))}
    </View>
  );
}

function Header({
  system,
  data,
  actions,
}: {
  system: SystemId;
  data: DashboardData;
  actions: DashboardActions;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm }}>
      <Pressable
        onPress={actions.onSystemMenu}
        accessibilityRole="button"
        accessibilityLabel="النظام: تبديل أو قفل"
        testID="dashboard-system">
        <Logo system={system} width={150} />
      </Pressable>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          alignSelf: 'stretch',
        }}>
        <Text variant="subhead" tone="secondary">
          {formatDay(data.date, true)}
        </Text>
        <Pressable
          onPress={actions.onEditRate}
          accessibilityRole="button"
          accessibilityLabel={`سعر الصرف ${formatRate(data.rate)}، تعديل`}
          testID="rate-row"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.ms,
            paddingVertical: spacing.xs,
            borderRadius: radius.full,
            backgroundColor: colors.accentSoft,
          }}>
          <Icon name="dollarsign.circle" size={16} color={colors.accent} />
          <Text variant="subhead" tone="accent">
            {formatRate(data.rate)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function TodayCard({ data, piece }: { data: DashboardData; piece: string }) {
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

function AttentionCard({ data, actions }: { data: DashboardData; actions: DashboardActions }) {
  const a = data.attention;
  const nothing = !a.lowCount && !a.outCount && !a.owed && !a.backupReminder;
  return (
    <Card style={{ flex: 1 }} testID="attention">
      <Title>يحتاج انتباهك</Title>
      {nothing ? (
        <Text variant="subhead" tone="secondary">
          لا شيء الآن: المخزون والديون والنسخ الاحتياطي بخير.
        </Text>
      ) : (
        <ListGroup>
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
          {a.backupReminder ? (
            <ListRow
              icon="externaldrive.badge.exclamationmark"
              title="نسخة احتياطية خارج الجهاز"
              subtitle={a.backupReminder}
              tone="warning"
              onPress={actions.onOpenBackup}
              testID="attention-backup"
            />
          ) : null}
        </ListGroup>
      )}
    </Card>
  );
}

/** ‹ نوفمبر 2026 ›: the previous month on the leading side, as time runs in Arabic. */
function MonthPicker({
  month,
  months,
  onMonth,
}: {
  month: MonthKey;
  months: MonthKey[];
  onMonth: (m: MonthKey) => void;
}) {
  const { colors } = useTheme();
  const i = months.indexOf(month);
  const older = i >= 0 && i < months.length - 1 ? months[i + 1] : null;
  const newer = i > 0 ? months[i - 1] : null;
  const arrow = (
    to: MonthKey | null,
    icon: 'chevron.backward' | 'chevron.forward',
    label: string,
  ) => (
    <Pressable
      onPress={() => to && onMonth(to)}
      disabled={!to}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={{ opacity: to ? 1 : 0.3, padding: spacing.xs }}
      testID={icon === 'chevron.backward' ? 'month-older' : 'month-newer'}>
      <Icon name={icon} size={18} color={colors.accent} weight="semibold" />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {arrow(older, 'chevron.backward', 'الشهر السابق')}
      <Text variant="title" testID="month-title">
        {monthTitle(month)}
      </Text>
      {arrow(newer, 'chevron.forward', 'الشهر التالي')}
    </View>
  );
}

function MonthCard({ data }: { data: DashboardData }) {
  const s = data.summary;
  const row = (label: string, value: string, sub?: string, strong = false) => (
    <View
      key={label}
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text variant={strong ? 'bodyStrong' : 'body'}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant={strong ? 'headline' : 'bodyStrong'}>{value}</Text>
        {sub ? (
          <Text variant="caption" tone="secondary">
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
  return (
    <Card style={{ flex: 1, gap: spacing.ms }} testID="month-summary">
      <Title>{`ملخص ${monthTitle(data.month)}`}</Title>
      {row('المبيعات', formatLyd(s.grossSales), formatUsd(s.grossSalesUsd))}
      {row('التكلفة', formatLyd(s.costOfSales))}
      {row('ربح المبيعات', formatLyd(s.grossProfit), formatUsd(s.grossProfitUsd))}
      {row('المرتجعات', formatLyd(s.refunds), `${s.itemsReturned} قطعة`)}
      {row('المصروفات', formatLyd(s.expenses))}
      {row('صافي الربح', formatLyd(s.netProfit), formatUsd(s.netProfitUsd), true)}
      <Text variant="caption" tone="secondary">
        {`${s.transactions} بيعة • ${s.itemsSold} قطعة`}
      </Text>
    </Card>
  );
}

const CHART_KINDS = [
  { value: 'app', label: 'رسم التطبيق' },
  { value: 'apple', label: 'رسم Apple' },
] as const;

function ChartCard({ data }: { data: DashboardData }) {
  // TEMPORARY (plan 8.4): both drawings, so the owner can choose on the devices.
  const [kind, setKind] = useState<(typeof CHART_KINDS)[number]['value']>('app');
  return (
    <Card style={{ flex: 1, gap: spacing.ms }}>
      <Title>المبيعات اليومية</Title>
      <Segmented options={[...CHART_KINDS]} value={kind} onChange={setKind} testID="chart-kind" />
      {kind === 'app' ? (
        <DailyChart month={data.month} days={data.daily} />
      ) : (
        <AppleDailyChart days={data.daily} />
      )}
    </Card>
  );
}

function LatestCard({
  data,
  onOpenSale,
}: {
  data: DashboardData;
  onOpenSale: (id: number) => void;
}) {
  return (
    <Card testID="latest-sales">
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

function StockCard({
  data,
  piece,
  onOpen,
}: {
  data: DashboardData;
  piece: string;
  onOpen: () => void;
}) {
  const s = data.stock;
  return (
    <Card testID="stock-summary">
      <Title>المخزون</Title>
      <ListGroup>
        <ListRow title="القطع في المخزون" value={`${s.pieces} ${piece}`} onPress={onOpen} />
        <ListRow title="الأصناف" value={String(s.items)} />
        <ListRow title="القيمة بالتكلفة" value={formatLyd(s.costValue)} />
        <ListRow title="القيمة بسعر البيع" value={formatLyd(s.priceValue)} />
      </ListGroup>
    </Card>
  );
}
