import { router } from 'expo-router';

import { EmptyState, Screen } from '@/components';
import { ManagementMenu, sectionHref } from '@/features/management/management-menu';
import { useLayout } from '@/hooks/use-layout';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/**
 * The Management tab's first screen. iPhone: the menu (a section opens over it, the tab bar
 * stays). iPad: the menu is beside this pane (see _layout), so until a section is chosen this
 * pane says so.
 */
export default function More() {
  const { split } = useLayout();
  const system = useCtx().system;
  if (split) {
    return (
      <Screen>
        <EmptyState
          icon="square.grid.2x2"
          title="الإدارة"
          message="اختر قسماً من القائمة ليظهر هنا."
        />
      </Screen>
    );
  }
  return <ManagementMenu onOpen={(t) => router.push(sectionHref(t, system))} />;
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more');
