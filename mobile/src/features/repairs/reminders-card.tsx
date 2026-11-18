import { Card, ListGroup, ListRow, Text } from '@/components';
import { shownName } from '@/domain/customers';
import type { Repair, RepairReminders } from '@/domain/repairs';
import { spacing } from '@/theme';

import { reminderRows } from './model';

export type RepairRemindersProps = {
  reminders: RepairReminders;
  phones: boolean;
  onOpenRepair: (id: number) => void;
  onOpenRepairs: () => void;
};

/**
 * The home screen's repair reminders (J3): late, due today, and ready and not collected after the
 * owner's days. A row with one repair opens it; more open the list.
 */
export function RepairRemindersCard({
  reminders,
  phones,
  onOpenRepair,
  onOpenRepairs,
}: RepairRemindersProps) {
  const rows = reminderRows(reminders);
  if (rows.length === 0) return null;
  const names = (list: Repair[]) =>
    list
      .slice(0, 3)
      .map((r) => `${r.description} (${shownName(r.customerName, phones)})`)
      .join('، ');
  return (
    <Card style={{ gap: spacing.sm }} testID="repair-reminders">
      <Text variant="headline">الصيانة</Text>
      <ListGroup>
        {rows.map((r) => (
          <ListRow
            key={r.key}
            icon={r.icon}
            tone={r.key === 'late' ? 'danger' : 'warning'}
            title={r.title}
            subtitle={names(r.repairs)}
            onPress={() =>
              r.repairs.length === 1 ? onOpenRepair(r.repairs[0].id) : onOpenRepairs()
            }
            testID={`repair-reminder-${r.key}`}
          />
        ))}
      </ListGroup>
    </Card>
  );
}
