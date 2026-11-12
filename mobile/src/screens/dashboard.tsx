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
 * The first tab. iPhone: one column. iPad: the month's numbers as a row of tiles, the daily chart
 * wide with its details beside it, and the breakdowns in one card with a switch, so no card sits
 * half empty (Split View narrows it back to one column).
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
  const wide = columns > 1;
  const piece = system === 'scarves' ? 'وشاح' : 'قطعة';
  const s = data.summary;
  const empty = s.transactions === 0 && s.refunds === 0;
  return (
    <Screen tabBar maxWidth={1400} contentStyle={{ gap: spacing.lg }}>
      <Header system={system} data={data} actions={actions} />
      <Grid columns={Math.min(columns, 2)}>
        <TodayCard data={data} piece={piece} />
        <AttentionCard data={data} actions={actions} />
      </Grid>
      <MonthPicker month={data.month} months={data.months} onMonth={actions.onMonth} />
      {empty ? (
        <EmptyMonth data={data} />
      ) : (
        <>
          <Grid columns={wide ? 4 : 2} testID="month-summary">
            <KpiTile
              label="المبيعات"
              value={formatLyd(s.grossSales)}
              sub={formatUsd(s.grossSalesUsd)}
            />
            <KpiTile
              label="ربح المبيعات"
              value={formatLyd(s.grossProfit)}
              sub={formatUsd(s.grossProfitUsd)}
            />
            <KpiTile
              label="صافي الربح"
              value={formatLyd(s.netProfit)}
              sub={formatUsd(s.netProfitUsd)}
              strong
            />
            <KpiTile
              label={system === 'scarves' ? 'الأوشحة المباعة' : 'القطع المباعة'}
              value={String(s.itemsSold)}
              sub={`${s.transactions} بيعة`}
            />
          </Grid>
          <Split wide={wide} ratio={2}>
            <ChartCard data={data} />
            <DetailsCard data={data} />
          </Split>
          <Split wide={wide}>
            <BreakdownCard system={system} data={data} piece={piece} />
            <LatestCard data={data} onOpenSale={actions.onOpenSale} />
          </Split>
        </>
      )}
      <StockTiles data={data} piece={piece} wide={wide} onOpen={actions.onOpenProducts} />
    </Screen>
  );
}

function Title({ children }: { children: string }) {
  return (
    <Text variant="headline" accessibilityRole="header" style={{ marginBottom: spacing.xs }}>
      {children}
    </Text>
  );
}

/** Lays cards out in rows of `columns`, each the same width (one column: full width). */
function Grid({
  columns,
  children,
  testID,
}: {
  columns: number;
  children: ReactNode;
  testID?: string;
}) {
  const [width, setWidth] = useState(0);
  const items = Children.toArray(children).filter(Boolean);
  const gap = spacing.md;
  const cell = columns > 1 && width > 0 ? (width - gap * (columns - 1)) / columns : undefined;
  return (
    <View
      testID={testID}
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

/**
 * Two cards side by side on iPad, the first `ratio` times as wide and both the same height;
 * stacked on iPhone.
 */
function Split({
  wide,
  ratio = 1,
  children,
}: {
  wide: boolean;
  ratio?: number;
  children: ReactNode;
}) {
  const [first, second] = Children.toArray(children);
  if (!wide) {
    return (
      <View style={{ gap: spacing.lg }}>
        {first}
        {second}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' }}>
      <View style={{ flex: ratio }}>{first}</View>
      <View style={{ flex: 1 }}>{second}</View>
    </View>
  );
}

/** One number of the month: label, value, and a smaller line under it. */
function KpiTile({
  label,
  value,
  sub,
  strong = false,
}: {
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
}) {
  return (
    // VoiceOver reads a tile as one item: "صافي الربح، 200 د.ل، $28.57".
    <Card
      style={{ flex: 1, gap: spacing.xs }}
      accessible
      accessibilityLabel={[label, value, sub].filter(Boolean).join('، ')}>
      <Text variant="subhead" tone="secondary">
        {label}
      </Text>
      <Text variant="number" tone={strong ? 'accent' : 'primary'}>
        {value}
      </Text>
      {sub ? (
        <Text variant="caption" tone="secondary">
          {sub}
        </Text>
      ) : null}
    </Card>
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
  const nothing = !a.lowCount && !a.outCount && !a.owed && !a.backupReminder && !a.dataProblem;
  return (
    <Card style={{ flex: 1 }} testID="attention">
      <Title>يحتاج انتباهك</Title>
      {nothing ? (
        <Text variant="subhead" tone="secondary">
          لا شيء الآن: المخزون والديون والنسخ الاحتياطي بخير.
        </Text>
      ) : (
        <ListGroup>
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

/** A month without sales: one card instead of a column of empty ones. */
function EmptyMonth({ data }: { data: DashboardData }) {
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

function ChartCard({ data }: { data: DashboardData }) {
  return (
    <Card style={{ flex: 1, gap: spacing.ms }}>
      <Title>المبيعات اليومية</Title>
      <DailyChart month={data.month} days={data.daily} />
    </Card>
  );
}

/** What the tiles don't show: cost, returns and expenses, and how net profit comes out. */
function DetailsCard({ data }: { data: DashboardData }) {
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
    <Card style={{ flex: 1, gap: spacing.ms }} testID="month-details">
      <Title>{`تفاصيل ${monthTitle(data.month)}`}</Title>
      {row('المبيعات', formatLyd(s.grossSales))}
      {row('التكلفة', formatLyd(s.costOfSales))}
      {row('المرتجعات', formatLyd(s.refunds), `${s.itemsReturned} قطعة`)}
      {row('المصروفات', formatLyd(s.expenses))}
      {row('صافي الربح', formatLyd(s.netProfit), undefined, true)}
    </Card>
  );
}

type BreakdownKind = 'category' | 'brand' | 'size' | 'payment' | 'top';

/** The month by category, brand, size (scarves), payment or best sellers: one card, one switch. */
function BreakdownCard({
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
      ) : (
        <RankedList rows={data.top} unit={piece} testID="top-products" />
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
function StockTiles({
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
