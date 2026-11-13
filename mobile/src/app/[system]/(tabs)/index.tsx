import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActionSheetIOS } from 'react-native';

import { firstBackup, lastCopied, saveBackup } from '@/backup/store';
import { errorBoundary } from '@/components/error-screen';
import { readDashboard } from '@/features/dashboard/model';
import { sectionHref } from '@/features/management/management-menu';
import { promptRate } from '@/features/settings/rate';
import { monthKey, type MonthKey } from '@/lib/dates';
import { logError } from '@/lib/error-log';
import { DashboardScreen } from '@/screens/dashboard';
import { useOnDataChanged } from '@/state/data-events';
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
  return (
    <EmployeeHomeScreen
      system={system}
      name={actor ? actorName(actor) : ''}
      data={data}
      actions={{
        onSystemMenu: systemMenu,
        onOpenSale: (id) => openSale(system, id),
        onNewSale: () => newSale(system),
        onNewReceipt: () => newReceipt(system),
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

  return (
    <DashboardScreen
      system={system}
      data={data}
      actions={{
        onSystemMenu: systemMenu,
        onEditRate: () => promptRate(ctx, refresh),
        onMonth: setMonth,
        onOpenSale: (id) => openSale(system, id),
        onOpenDebts: () => router.push(sectionHref('debts', system)),
        onOpenBackup: () => router.push(sectionHref('backup', system)),
        onOpenProducts: () => router.push({ pathname: '/[system]/products', params: { system } }),
        onNewSale: () => newSale(system),
        onNewReceipt: () => newReceipt(system),
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
