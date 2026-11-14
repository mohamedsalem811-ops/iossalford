import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';

import { Text } from '@/components';
import { listSets } from '@/domain/sets';
import { SetList } from '@/features/sets/set-picker';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { useReadable } from '@/hooks/use-readable';
import { spacing, useTheme } from '@/theme';
import { errorBoundary } from '@/components/error-screen';
import { Allowed } from '@/staff/allowed';

/** Management → Sets: create, edit and delete the sets the shop sells. */
function ManageSetsRouteScreen() {
  const ctx = useCtx();
  const readable = useReadable();
  const { colors } = useTheme();
  const read = useCallback(() => listSets(ctx), [ctx]);
  const [sets, setSets] = useState(read);
  const refresh = useCallback(() => setSets(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const open = (id: number | 'new') =>
    router.push({ pathname: '/[system]/set/[id]', params: { system: ctx.system, id: String(id) } });
  return (
    <>
      <Stack.Title>الأطقم</Stack.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="plus" accessibilityLabel="طقم جديد" onPress={() => open('new')}>
          طقم جديد
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        onLayout={readable.onLayout}
        contentContainerStyle={{
          ...readable.padding,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
        contentInsetAdjustmentBehavior="automatic">
        <SetList
          ctx={ctx}
          sets={sets}
          onPress={(s) => open(s.id)}
          emptyAction="طقم جديد"
          onEmptyAction={() => open('new')}
        />
        {sets.length > 0 ? (
          <Text variant="caption" tone="secondary" center>
            اضغط على الطقم لتعديله أو حذفه. يُضاف الطقم للسلة من زر الأطقم في شاشة البيع.
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}

/** Guarded as a whole: only someone with `sets.edit` can open it (see staff/permissions.ts). */
export default function ManageSetsRoute() {
  return (
    <Allowed permission="sets.edit" title="الأطقم">
      <ManageSetsRouteScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/manage-sets');
