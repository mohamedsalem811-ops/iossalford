import { Alert, ScrollView, View } from 'react-native';

import { Badge, Button, Card, EmptyState, ListGroup, ListRow, Page, Text } from '@/components';
import { RuleError, type Ctx } from '@/domain/context';
import { waLink } from '@/domain/customer-care';
import { getCustomer, shownName } from '@/domain/customers';
import { getMarketing } from '@/domain/marketing';
import { lastMessage, recordMessage } from '@/domain/messages';
import {
  cancelRepair,
  deliverRepair,
  moveRepair,
  OPEN_REPAIR_STATUSES,
  REPAIR_METHOD_LABELS,
  repairReadyMessage,
  setRepairCost,
  setRepairDate,
  WORK_LABELS,
  type Repair,
  type RepairCancelHow,
  type RepairDeliverMethod,
  type RepairPayment,
} from '@/domain/repairs';
import { ProductPhoto } from '@/features/products/product-photo';
import { dayKey, formatDate, formatTime } from '@/lib/dates';
import { parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { formatLyd } from '@/lib/money';
import { askCode } from '@/staff/approvals';
import { useCan } from '@/staff/use-can';
import { notifyDataChanged } from '@/state/data-events';
import { openOutside } from '@/state/lock';
import { radius, spacing } from '@/theme';

import { dayText, moneyLine, needsAttention, statusLine } from './model';

const when = (stamp: string) => `${formatDate(new Date(stamp))} ${formatTime(new Date(stamp))}`;

export type RepairActions = {
  onTicket: () => void;
  onCustomer: (customerId: number) => void;
};

/** Runs a repair action; a refusal is shown, and the screens are told when it worked. */
function attempt(what: string, run: () => unknown): boolean {
  try {
    run();
  } catch (error) {
    haptic.error();
    Alert.alert(what, error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع.');
    return false;
  }
  haptic.success();
  notifyDataChanged();
  return true;
}

/**
 * One repair (J3): the piece and its photos, the work, for whom, its stage and ready date, the
 * money (and the workshop's cost, for the owner), every payment, and what can be done next by
 * whoever is signed in: to the workshop, ready, the WhatsApp message, delivery, the ticket, a new
 * date, and cancelling (the owner).
 */
export function RepairDetail({
  ctx,
  repair,
  payments,
  actions,
}: {
  ctx: Ctx;
  repair: Repair | undefined;
  payments: RepairPayment[];
  actions: RepairActions;
}) {
  const mayTake = useCan('repairs.take');
  const mayDeliver = useCan('repairs.deliver');
  const mayCost = useCan('repairs.cost');
  const mayCancel = useCan('repairs.cancel');
  const phones = useCan('customers.phones');
  if (!repair) return <EmptyState icon="wrench.and.screwdriver" title="الصيانة غير موجودة" />;
  const r = repair;
  const today = dayKey(ctx.now());
  const open = OPEN_REPAIR_STATUSES.includes(r.status);
  const customer = getCustomer(ctx, r.customerId);

  const message =
    r.status === 'ready' ? repairReadyMessage(r, getMarketing(ctx).templates.repairReady) : null;
  const link = message && phones ? waLink(customer?.phone, message) : null;
  const sentAt = message ? lastMessage(ctx, r.customerId, 'repair-ready', r.id) : null;
  const send = () => {
    if (!link) return;
    try {
      recordMessage(ctx, { customerId: r.customerId, kind: 'repair-ready', ref: r.id });
    } catch (error) {
      // Remembering it is a convenience: the message still opens.
      if (!(error instanceof RuleError)) throw error;
    }
    notifyDataChanged();
    openOutside(link);
  };

  const deliver = () => {
    haptic.medium();
    const go = async (method: RepairDeliverMethod) => {
      // The rest left on her account (آجل): an employee needs the owner's credit code (rule B).
      let creditApproval: string | undefined;
      if (method === 'credit' && ctx.actor?.kind !== 'owner') {
        creditApproval = (await askCode(ctx, 'credit', `تسليم ${r.ticketNo} بالآجل`)) ?? undefined;
        if (!creditApproval) return;
      }
      attempt('لم تُسلّم', () => deliverRepair(ctx, r.id, { method, creditApproval }));
    };
    if (r.remaining === 0)
      return Alert.alert(`تسليم ${r.ticketNo}؟`, 'لا باقي عليها.', [
        { text: 'رجوع', style: 'cancel' },
        { text: 'تسليم', onPress: () => go('cash') },
      ]);
    Alert.alert(`تسليم ${r.ticketNo}`, `الباقي ${formatLyd(r.remaining)}: كيف دُفع؟`, [
      ...(['cash', 'card', 'transfer', 'credit'] as const).map((m) => ({
        text: m === 'credit' ? 'آجل (على حسابها)' : REPAIR_METHOD_LABELS[m],
        onPress: () => go(m),
      })),
      { text: 'رجوع', style: 'cancel' as const },
    ]);
  };

  const newDate = () =>
    Alert.prompt(
      'موعد جديد للجاهزية',
      'مثل 2026-12-01',
      (text) => text && attempt('لم يُحفظ', () => setRepairDate(ctx, r.id, text)),
      'plain-text',
      r.readyBy,
    );

  const cost = () =>
    Alert.prompt(
      'تكلفة الورشة',
      'بالدينار، للربح (لا تراها الموظفات)',
      (text) => {
        const value = text.trim() ? parseThousandths(text) : null;
        if (text.trim() && value === null) return Alert.alert('لم يُحفظ', 'التكلفة غير صحيحة');
        attempt('لم يُحفظ', () => setRepairCost(ctx, r.id, value));
      },
      'plain-text',
      r.cost !== null ? String(r.cost / 1000) : '',
      'decimal-pad',
    );

  const cancel = () => {
    haptic.medium();
    const go = (how: RepairCancelHow) =>
      attempt('لم تُلغَ', () => cancelRepair(ctx, r.id, { how }));
    if (r.paid === 0)
      return Alert.alert(`إلغاء ${r.ticketNo}؟`, 'لم يُدفع عربون.', [
        { text: 'رجوع', style: 'cancel' },
        { text: 'إلغاء الصيانة', style: 'destructive', onPress: () => go('refund') },
      ]);
    Alert.alert(`إلغاء ${r.ticketNo}؟`, `العربون ${formatLyd(r.paid)}:`, [
      { text: 'استرداد بطريقة الدفع', onPress: () => go('refund') },
      { text: 'إلى رصيدها (له رصيد)', onPress: () => go('balance') },
      { text: 'رجوع', style: 'cancel' },
    ]);
  };

  const settledText =
    r.cancelHow === 'balance' && r.settled > 0
      ? `نُقل العربون ${formatLyd(r.settled)} إلى رصيد الزبون`
      : r.cancelHow === 'refund' && r.settled > 0
        ? `استُرد العربون ${formatLyd(r.settled)}`
        : null;

  return (
    <Page>
      <Card>
        {r.photos.length ? (
          <ScrollView horizontal contentContainerStyle={{ gap: spacing.sm }}>
            {r.photos.map((file) => (
              <ProductPhoto
                key={file}
                system={ctx.system}
                imageFile={file}
                size={140}
                rounded={radius.lg}
              />
            ))}
          </ScrollView>
        ) : null}
        <Text variant="title" testID="repair-title">
          {r.description}
        </Text>
        <Text variant="subhead" tone="secondary">
          {`${WORK_LABELS[r.work]} • ${r.ticketNo}`}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <Badge
            label={statusLine(r, today)}
            tone={needsAttention(r, today) ? 'warning' : 'accent'}
          />
        </View>
        {r.note ? <Text variant="body">{r.note}</Text> : null}
      </Card>

      <ListGroup header="الزبون">
        <ListRow
          icon="person"
          title={shownName(r.customerName, phones)}
          onPress={() => actions.onCustomer(r.customerId)}
          testID="repair-customer"
        />
      </ListGroup>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="body">السعر المتفق عليه</Text>
          <Text variant="headline">{r.price === 0 ? 'مجانية' : formatLyd(r.price)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="body">المدفوع</Text>
          <Text variant="headline" tone="accent" testID="repair-paid">
            {formatLyd(r.paid)}
          </Text>
        </View>
        {open ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="body">الباقي عند الاستلام</Text>
            <Text variant="headline" testID="repair-remaining">
              {formatLyd(r.remaining)}
            </Text>
          </View>
        ) : null}
        <Text variant="subhead" tone={needsAttention(r, today) ? 'warning' : 'secondary'}>
          {`موعد الجاهزية: ${dayText(r.readyBy)}`}
        </Text>
        {mayCost ? (
          <Text variant="caption" tone="secondary" testID="repair-cost">
            {r.cost === null
              ? 'تكلفة الورشة: لم تُكتب بعد'
              : `تكلفة الورشة ${formatLyd(r.cost)} • الربح ${formatLyd(r.price - r.cost)}`}
          </Text>
        ) : null}
        {settledText ? (
          <Text variant="subhead" tone="secondary" testID="repair-settled">
            {settledText}
          </Text>
        ) : null}
        {!open ? (
          <Text variant="caption" tone="secondary">
            {moneyLine(r)}
          </Text>
        ) : null}
      </Card>

      <View style={{ gap: spacing.sm }}>
        {open && mayDeliver && r.status === 'ready' ? (
          <Button
            title={
              r.remaining > 0 ? `تسليم للزبون • الباقي ${formatLyd(r.remaining)}` : 'تسليم للزبون'
            }
            icon="bag.fill"
            size="lg"
            fullWidth
            onPress={deliver}
            testID="repair-deliver"
          />
        ) : null}
        {open && mayDeliver && r.status === 'received' ? (
          <Button
            title="إلى الورشة"
            icon="wrench.and.screwdriver"
            fullWidth
            onPress={() => attempt('لم يُحفظ', () => moveRepair(ctx, r.id, 'workshop'))}
            testID="repair-workshop"
          />
        ) : null}
        {open && mayDeliver && r.status !== 'ready' ? (
          <Button
            title="جاهزة للاستلام"
            icon="checkmark.seal"
            variant={r.status === 'received' ? 'secondary' : 'primary'}
            fullWidth
            onPress={() => attempt('لم يُحفظ', () => moveRepair(ctx, r.id, 'ready'))}
            testID="repair-ready"
          />
        ) : null}
        {link ? (
          <View style={{ gap: spacing.xxs }}>
            <Button
              title="رسالة: جاهزة للاستلام"
              icon="message"
              variant="secondary"
              fullWidth
              onPress={send}
              testID="repair-whatsapp"
            />
            {sentAt ? (
              <Text variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
                {`فُتحت الرسالة ${when(sentAt)}`}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Button
          title="إيصال الصيانة"
          icon="printer"
          variant="secondary"
          fullWidth
          onPress={actions.onTicket}
          testID="repair-ticket"
        />
        {open && mayTake ? (
          <Button
            title="تغيير موعد الجاهزية"
            icon="calendar"
            variant="secondary"
            fullWidth
            onPress={newDate}
            testID="repair-date"
          />
        ) : null}
        {mayCost && r.status !== 'cancelled' ? (
          <Button
            title="تكلفة الورشة"
            icon="banknote"
            variant="secondary"
            fullWidth
            onPress={cost}
            testID="repair-set-cost"
          />
        ) : null}
        {open && mayCancel ? (
          <Button
            title="إلغاء الصيانة"
            icon="xmark.circle"
            variant="secondary"
            fullWidth
            onPress={cancel}
            testID="repair-cancel"
          />
        ) : null}
      </View>

      {payments.length ? (
        <ListGroup header="الدفعات">
          {payments.map((p) => (
            <ListRow
              key={p.id}
              icon={p.kind === 'pay' ? 'arrow.down.circle' : 'arrow.up.circle'}
              title={`${p.kind === 'pay' ? 'دفعة' : 'استرداد'} ${formatLyd(p.amount)} • ${REPAIR_METHOD_LABELS[p.method]}`}
              subtitle={[when(p.createdAt), p.byName].filter(Boolean).join(' • ')}
              testID={`repair-payment-${p.id}`}
            />
          ))}
        </ListGroup>
      ) : null}

      <Text variant="caption" tone="secondary">
        {[
          `استُلمت ${when(r.createdAt)}${r.byName ? ` • ${r.byName}` : ''}`,
          r.workshopAt ? `في الورشة ${when(r.workshopAt)}` : null,
          r.readyAt ? `جاهزة ${when(r.readyAt)}` : null,
          r.deliveredAt ? `سُلّمت ${when(r.deliveredAt)}` : null,
          r.cancelledAt ? `أُلغيت ${when(r.cancelledAt)}` : null,
        ]
          .filter(Boolean)
          .join('\n')}
      </Text>
    </Page>
  );
}
