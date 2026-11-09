import type { SymbolViewProps } from 'expo-symbols';

import { EmptyState, Screen, Text } from '@/components';

/** A tab whose screen is built in a later phase. */
export function ComingSoonScreen({
  title,
  icon,
}: {
  title: string;
  icon: SymbolViewProps['name'];
}) {
  return (
    <Screen tabBar>
      <Text variant="largeTitle">{title}</Text>
      <EmptyState icon={icon} title="قريباً" message="هذه الشاشة قيد الإنشاء." />
    </Screen>
  );
}
