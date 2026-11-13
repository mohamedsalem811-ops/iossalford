import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, EmptyState, ListGroup, ListRow, Page, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import {
  employeeStatement,
  KIND_LABELS,
  recordRepayment,
  type LedgerLine,
} from '@/domain/staff-ledger';
import { showError } from '@/features/products/actions';
import { formatDate } from '@/lib/dates';
import { parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { formatLyd } from '@/lib/money';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { actorKey } from '@/staff/model';
import { useStaff } from '@/staff/store';
import { useActor, useCan } from '@/staff/use-can';

const lineTitle = (l: LedgerLine) =>
  `${KIND_LABELS[l.kind]}${l.returnId ? ` • مرتجع رقم ${l.returnId}` : ''}`;

/**
 * An employee's account (phase S4): returns put on their account, waived, and what they paid
 * back, with the balance after each line. The owner reads anyone's and records repayments; an
 * employee reads only their own.
 */
function AccountScreen() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  const staff = useStaff();
  const employee = staff.employees.find((e) => e.id === id);
  const key = `emp-${id}`;
  const actor = useActor();
  const owner = useCan('staff.ledger');
  const mine = actor ? actorKey(actor) === key : false;
  const read = useCallback(
    () => (owner || mine ? employeeStatement(ctx, key) : null),
    [ctx, key, owner, mine],
  );
  const [statement, setStatement] = useState(read);
  const refresh = useCallback(() => setStatement(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);

  if (!employee || !statement)
    return <EmptyState icon="lock" title={employee ? 'للمالك فقط' : 'الموظف غير موجود'} />;

  const repay = () =>
    Alert.prompt(
      `سداد ${employee.name}`,
      `عليه ${formatLyd(statement.balance)}. المبلغ الذي دفعه:`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حفظ',
          onPress: (text?: string) => {
            const amount = parseThousandths(text ?? '');
            if (!amount) {
              haptic.error();
              Alert.alert('لم يتم الحفظ', 'اكتب المبلغ بالدينار.');
              return;
            }
            try {
              recordRepayment(ctx, { key, name: employee.name }, amount);
            } catch (error) {
              showError(error);
              return;
            }
            haptic.success();
            notifyDataChanged();
          },
        },
      ],
      'plain-text',
      '',
      'decimal-pad',
    );

  return (
    <>
      <Stack.Title>{`حساب ${employee.name}`}</Stack.Title>
      <Page>
        <Card>
          <Text variant="subhead" tone="secondary">
            {statement.balance > 0 ? 'عليه' : 'الحساب'}
          </Text>
          <Text
            variant="title"
            tone={statement.balance > 0 ? 'warning' : 'primary'}
            testID="account-balance">
            {statement.balance > 0 ? formatLyd(statement.balance) : 'لا شيء عليه'}
          </Text>
          {owner ? (
            <Button title="تسجيل سداد" icon="banknote" onPress={repay} testID="account-repay" />
          ) : null}
        </Card>
        {statement.lines.length === 0 ? (
          <EmptyState icon="list.bullet" title="لا توجد حركات" />
        ) : (
          <ListGroup header="الحركات">
            {[...statement.lines].reverse().map((l) => (
              <ListRow
                key={l.id}
                title={lineTitle(l)}
                subtitle={[formatDate(new Date(l.createdAt)), l.note].filter(Boolean).join(' • ')}
                value={`${l.kind === 'charge' ? '+' : '−'}${formatLyd(l.amount)}`}
                chevron={false}
                testID={`account-line-${l.id}`}
              />
            ))}
          </ListGroup>
        )}
      </Page>
    </>
  );
}

export default AccountScreen;

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/account');
