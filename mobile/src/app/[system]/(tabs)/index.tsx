import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, Linking } from 'react-native';

import { firstBackup, lastCopied, saveBackup } from '@/backup/store';
import { errorBoundary } from '@/components/error-screen';
import { acknowledgeAlert, type OwnerAlert } from '@/domain/alerts';
import type { Ctx } from '@/domain/context';
import { readDashboard } from '@/features/dashboard/model';
import { waLink } from '@/domain/customer-care';
import {
  getMarketing,
  giftMessage,
  giftReminders,
  markGiftDone,
  type Gift,
} from '@/domain/marketing';
import { recordMessage } from '@/domain/messages';
import { orderReminders } from '@/domain/orders';
import type { GiftRemindersProps } from '@/features/marketing/gift-reminders';
import type { OrderRemindersProps } from '@/features/orders/reminders-card';
import { showError } from '@/features/products/actions';
import { haptic } from '@/lib/haptics';
import { sectionHref } from '@/features/management/management-menu';
import { promptRate } from '@/features/settings/rate';
import { monthKey, type MonthKey } from '@/lib/dates';
import { logError } from '@/lib/error-log';
import { DashboardScreen } from '@/screens/dashboard';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useLock } from '@/state/lock';
import { useCtx } from '@/state/system-db';
import { readMySales } from '@/features/dashboard/my-sales';
import { EmployeeHomeScreen } from '@/screens/employee-home';
import { actorName } from '@/staff/model';
import { useActor, useCan } from '@/staff/use-can';

const OTHER = { jewelry: 'الأوشحة', scarves: 'المجوهرات' } as const;

/** The home tab: the owner's dashboard, or an employee's own sales (phase S2). */
export default function Home() {
  return useCan('reports.view') ? <Dashboard /> : <EmployeeHome />;
}

/** The logo's menu: switch system or lock, saving a backup first. */
function useSystemMenu() {
  const ctx = useCtx();
  const system = ctx.system;
  const { lock } = useLock();
  /** Leaving the system by hand saves a backup too (skipped when nothing changed). */
  const backupNow = () => {
    try {
      saveBackup(ctx, 'auto');
    } catch (error) {
      logError('نسخة عند القفل أو التبديل', error);
    }
  };
  return () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [`التبديل إلى ${OTHER[system]}`, 'قفل النظام', 'إلغاء'],
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) {
          backupNow();
          router.replace('/');
        }
        if (i === 1) {
          backupNow();
          lock();
        }
      },
    );
}

const openSale = (system: string, id: number) =>
  router.push({ pathname: '/[system]/more/sale/[id]', params: { system, id: String(id) } });
const newSale = (system: string) => router.push({ pathname: '/[system]/sale', params: { system } });
const newReceipt = (system: string) =>
  router.push({ pathname: '/[system]/receipt/[id]', params: { system, id: 'new' } });

const newOrder = (system: string) =>
  router.push({ pathname: '/[system]/order-form', params: { system } });

/** The home shortcuts of I3 that depend on what this person may do. */
function useShortcuts() {
  const ctx = useCtx();
  const system = ctx.system;
  const mayOrder = useCan('orders.take');
  const mayReturn = useCan('returns.create');
  const mayPay = useCan('payments.create');
  return {
    onNewOrder: mayOrder ? () => newOrder(system) : undefined,
    onReturn: mayReturn ? () => router.push(sectionHref('returnFind', system)) : undefined,
    onDebtPayment: mayPay ? () => router.push(sectionHref('debts', system)) : undefined,
    onCustomer: () => router.push(sectionHref('customers', system)),
  };
}

/** The deposit reminders for the home screen (I2), fresh on focus and after each change. */
function useOrderReminders(): OrderRemindersProps | undefined {
  const ctx = useCtx();
  const system = ctx.system;
  const may = useCan('orders.take');
  const owner = useCan('orders.purchase');
  const phones = useCan('customers.phones');
  const read = useCallback(() => (may ? orderReminders(ctx) : undefined), [ctx, may]);
  const [reminders, setReminders] = useState(read);
  const refresh = useCallback(() => setReminders(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  if (!reminders) return undefined;
  return {
    reminders,
    owner,
    phones,
    onOpenOrder: (id) =>
      router.push({ pathname: '/[system]/more/order/[id]', params: { system, id: String(id) } }),
    onOpenOrders: () => router.push(sectionHref('orders', system)),
  };
}

/** The gift reminders a week before (I4), for someone who may edit customers. */
function useGiftReminders(): GiftRemindersProps | undefined {
  const ctx = useCtx();
  const system = ctx.system;
  const may = useCan('customers.edit');
  const phones = useCan('customers.phones');
  const read = useCallback(() => (may ? giftReminders(ctx) : undefined), [ctx, may]);
  const [gifts, setGifts] = useState(read);
  const refresh = useCallback(() => setGifts(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  if (!gifts) return undefined;
  const done = (g: Gift) => {
    try {
      markGiftDone(ctx, g.id);
    } catch (error) {
      showError(error);
      return false;
    }
    haptic.success();
    notifyDataChanged();
    return true;
  };
  const message = (g: Gift) => {
    const link = waLink(g.customerPhone, giftMessage(getMarketing(ctx).templates.gift, g));
    if (!link) return;
    try {
      recordMessage(ctx, {
        customerId: g.customerId,
        kind: 'gift',
        ref: `${g.id}-${ctx.now().getFullYear()}`,
      });
    } catch (error) {
      showError(error);
      return;
    }
    if (done(g)) Linking.openURL(link).catch(() => {});
  };
  return {
    gifts,
    phones,
    onGift: (g) =>
      Alert.alert(
        `هدية لـ${g.forWhom}`,
        `${g.customerName}${g.occasion ? ` • ${g.occasion}` : ''}`,
        [
          ...(phones && g.customerPhone
            ? [{ text: 'رسالة واتساب', onPress: () => message(g) }]
            : []),
          { text: 'تم', onPress: () => done(g) },
          {
            text: 'صفحة الزبون',
            onPress: () =>
              router.push({
                pathname: '/[system]/more/customer/[id]',
                params: { system, id: String(g.customerId) },
              }),
          },
          { text: 'إلغاء', style: 'cancel' },
        ],
      ),
  };
}

/** Where an alert leads (phase S6): the shift's report, the return, or the activity log. */
function openAlertTarget(system: string, alert: OwnerAlert) {
  const t = alert.target;
  if (t.screen === 'shift')
    router.push({
      pathname: '/[system]/more/shift-report/[id]',
      params: { system, id: String(t.id) },
    });
  else if (t.screen === 'return')
    router.push({ pathname: '/[system]/return-detail/[id]', params: { system, id: String(t.id) } });
  else router.push(sectionHref('log', system as 'jewelry'));
}

/** An alert's details, with "open" and "seen" (the seen one is hidden and logged). */
function showAlert(ctx: Ctx, alert: OwnerAlert, refresh: () => void) {
  Alert.alert(alert.title, alert.detail, [
    { text: 'إغلاق', style: 'cancel' },
    { text: 'فتح', onPress: () => openAlertTarget(ctx.system, alert) },
    {
      text: 'اطلعت',
      onPress: () => {
        try {
          acknowledgeAlert(ctx, alert);
        } catch (error) {
          showError(error);
          return;
        }
        haptic.success();
        notifyDataChanged();
        refresh();
      },
    },
  ]);
}

/** An employee's home: shortcuts and their own sales only. */
function EmployeeHome() {
  const ctx = useCtx();
  const system = ctx.system;
  const actor = useActor();
  const read = useCallback(() => readMySales(ctx), [ctx]);
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const systemMenu = useSystemMenu();
  const orders = useOrderReminders();
  const gifts = useGiftReminders();
  const shortcuts = useShortcuts();
  return (
    <EmployeeHomeScreen
      system={system}
      name={actor ? actorName(actor) : ''}
      data={data}
      orders={orders}
      gifts={gifts}
      actions={{
        onSystemMenu: systemMenu,
        onOpenSale: (id) => openSale(system, id),
        onNewSale: () => newSale(system),
        ...shortcuts,
        onOpenAccount: () =>
          actor?.kind === 'employee' &&
          router.push({
            pathname: '/[system]/more/account/[id]',
            params: { system, id: actor.id },
          }),
        onOpenShift: () => router.push(sectionHref('shift', system)),
      }}
    />
  );
}

/** The dashboard: today, what needs attention, the chosen month, breakdowns, latest sales. */
function Dashboard() {
  const ctx = useCtx();
  const system = ctx.system;
  const [month, setMonth] = useState<MonthKey>(() => monthKey(ctx.now()));
  const read = useCallback(
    () =>
      readDashboard(ctx, month, {
        lastCopied: lastCopied(system),
        firstBackup: firstBackup(system),
      }),
    [ctx, month, system],
  );
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  // Fresh figures each time the tab comes back into view (after a sale, a return...).
  useFocusEffect(refresh);
  useOnDataChanged(refresh);

  const systemMenu = useSystemMenu();
  const orders = useOrderReminders();
  const gifts = useGiftReminders();
  const shortcuts = useShortcuts();

  return (
    <DashboardScreen
      system={system}
      data={data}
      orders={orders}
      gifts={gifts}
      actions={{
        onSystemMenu: systemMenu,
        onEditRate: () => promptRate(ctx, refresh),
        onMonth: setMonth,
        onOpenSale: (id) => openSale(system, id),
        onOpenDebts: () => router.push(sectionHref('debts', system)),
        onOpenBirthdays: () =>
          router.push({ pathname: '/[system]/more/customer-care', params: { system } }),
        onOpenSetup: () => router.push({ pathname: '/[system]/more/loyalty', params: { system } }),
        onOpenBackup: () => router.push(sectionHref('backup', system)),
        onOpenDay: () => router.push(sectionHref('daySummary', system)),
        onOpenProducts: () => router.push({ pathname: '/[system]/products', params: { system } }),
        onOpenAlert: (alert) => showAlert(ctx, alert, refresh),
        onNewSale: () => newSale(system),
        onNewReceipt: () => newReceipt(system),
        ...shortcuts,
        onNewProduct: () =>
          router.push(
            system === 'scarves'
              ? { pathname: '/[system]/design/[id]', params: { system, id: 'new' } }
              : { pathname: '/[system]/product/[id]', params: { system, id: 'new' } },
          ),
      }}
    />
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('dashboard');
