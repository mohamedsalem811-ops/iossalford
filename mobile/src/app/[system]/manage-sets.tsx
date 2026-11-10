import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';

import { Text } from '@/components';
import { listSets } from '@/domain/sets';
import { SetList } from '@/features/sets/set-picker';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { spacing, useTheme } from '@/theme';

/** Management → Sets: create, edit and delete the sets the shop sells. */
export default function ManageSetsRoute() {
  const ctx = useCtx();
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
        <Stack.Toolbar.Button
          icon="plus"
          accessibilityLabel="طقم جديد"
          onPress={() => open('new')}
        />
      </Stack.Toolbar>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: spacing.md,
          gap: spacing.md,
          width: '100%',
          maxWidth: 760,
          alignSelf: 'center',
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
