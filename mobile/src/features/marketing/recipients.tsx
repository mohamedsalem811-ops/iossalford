import { View } from 'react-native';

import { Button, EmptyState, ListGroup, ListRow } from '@/components';
import { shownPhone, type Customer } from '@/domain/customers';
import { spacing } from '@/theme';

/**
 * Who gets a message (I4): the owner ticks each customer (all ticked at first), with «تحديد الكل»
 * and «إلغاء الكل». Only customers the caller passed (those who accept offers, with a phone).
 */
export function Recipients({
  customers,
  chosen,
  onChange,
  header,
  subtitle,
  testID,
}: {
  customers: Customer[];
  chosen: Set<number>;
  onChange: (chosen: Set<number>) => void;
  header: string;
  subtitle?: (c: Customer) => string | undefined;
  testID: string;
}) {
  if (!customers.length)
    return <EmptyState icon="person.2" title="لا يوجد زبائن يقبلون العروض بأرقام هواتف" />;
  const toggle = (id: number) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const all = chosen.size === customers.length;
  return (
    <View style={{ gap: spacing.sm }}>
      <Button
        title={all ? 'إلغاء الكل' : 'تحديد الكل'}
        variant="secondary"
        onPress={() => onChange(all ? new Set() : new Set(customers.map((c) => c.id)))}
        testID={`${testID}-all`}
      />
      <ListGroup header={`${header} (${chosen.size} من ${customers.length})`}>
        {customers.map((c) => (
          <ListRow
            key={c.id}
            icon={chosen.has(c.id) ? 'checkmark.circle.fill' : 'circle'}
            title={c.name}
            subtitle={subtitle?.(c) ?? shownPhone(c.phone, true) ?? undefined}
            selected={chosen.has(c.id)}
            chevron={false}
            onPress={() => toggle(c.id)}
            testID={`${testID}-${c.id}`}
          />
        ))}
      </ListGroup>
    </View>
  );
}
