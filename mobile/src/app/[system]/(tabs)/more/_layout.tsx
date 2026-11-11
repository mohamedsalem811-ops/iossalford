import { router, Stack, useSegments } from 'expo-router';
import { View } from 'react-native';

import { LIST_PANE_WIDTH } from '@/components/split-view';
import { useTabStackOptions } from '@/components/tab-stack';
import {
  ManagementMenu,
  SECTION_ROUTE,
  sectionHref,
  sectionOf,
} from '@/features/management/management-menu';
import { useLayout } from '@/hooks/use-layout';
import type { ManageTarget } from '@/screens/management';
import { useCtx } from '@/state/system-db';
import { useTheme } from '@/theme';

/**
 * The Management tab's own stack, so Sales, Customers and the rest open inside the tab and the
 * tab bar stays, as in Apple's apps.
 *
 * iPad (and wide Split View windows): the menu stays on the leading side (the right, in Arabic),
 * as in the iPad Settings app, and the chosen section opens beside it with its own header;
 * deeper screens (a sale, a customer) open inside that pane with a back button.
 */
export default function ManagementLayout() {
  const { split } = useLayout();
  const { colors } = useTheme();
  const options = useTabStackOptions();
  const system = useCtx().system;
  const segments = useSegments() as string[];
  const selected = sectionOf(segments[segments.indexOf('more') + 1]);

  // On iPad a section is the root of its pane: no back button to the empty pane behind it.
  const section = { headerBackVisible: !split, gestureEnabled: !split };
  const open = (target: ManageTarget) => {
    if (target === selected && segments.length === segments.indexOf('more') + 2) return;
    if (router.canDismiss()) router.dismissAll();
    router.push(sectionHref(target, system));
  };

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      {split ? (
        <View
          style={{ width: LIST_PANE_WIDTH, borderEndWidth: 1, borderEndColor: colors.separator }}
          testID="manage-sidebar">
          <ManagementMenu selected={selected} onOpen={open} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Stack screenOptions={options}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          {Object.values(SECTION_ROUTE).map((name) => (
            <Stack.Screen key={name} name={name} options={section} />
          ))}
        </Stack>
      </View>
    </View>
  );
}
