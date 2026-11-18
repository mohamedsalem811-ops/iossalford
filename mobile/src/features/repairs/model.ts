/**
 * What the repair screens show and check (J3), apart from the screens so it can be tested.
 */
import { DEFAULT_TEMPLATE } from '@/domain/receipts';
import {
  REPAIR_STATUS_LABELS,
  WORK_LABELS,
  type Repair,
  type RepairPayMethod,
  type RepairReminders,
  type RepairWork,
} from '@/domain/repairs';
import { etaText } from '@/domain/orders';
import { formatTime } from '@/lib/dates';
import { parseThousandths } from '@/lib/digits';
import { formatLyd } from '@/lib/money';
import type { ReceiptDoc } from '@/receipts/templates/html';
import type { SystemId } from '@/theme';

/** "20/11/2026" */
export const dayText = etaText;

/** "استُلمت • جاهزة 20/11/2026", "متأخرة: كانت 20/11/2026", or "جاهزة للاستلام". */
export function statusLine(r: Pick<Repair, 'status' | 'readyBy'>, today: string): string {
  if (r.status === 'ready') return 'جاهزة للاستلام';
  if (r.status === 'received' || r.status === 'workshop')
    return r.readyBy < today
      ? `متأخرة: كانت ${dayText(r.readyBy)} • ${REPAIR_STATUS_LABELS[r.status]}`
      : `${REPAIR_STATUS_LABELS[r.status]} • جاهزة ${dayText(r.readyBy)}`;
  return REPAIR_STATUS_LABELS[r.status];
}

/** Not ready and past its date: shown in the warning colour. */
export const needsAttention = (r: Pick<Repair, 'status' | 'readyBy'>, today: string) =>
  (r.status === 'received' || r.status === 'workshop') && r.readyBy < today;

/** "50 د.ل • مدفوع 20 د.ل • الباقي 30 د.ل", or "مجانية". */
export const moneyLine = (r: Pick<Repair, 'price' | 'paid' | 'remaining'>) =>
  r.price === 0
    ? 'مجانية'
    : [
        formatLyd(r.price),
        r.paid > 0 ? `مدفوع ${formatLyd(r.paid)}` : null,
        r.remaining > 0 ? `الباقي ${formatLyd(r.remaining)}` : 'مدفوعة بالكامل',
      ]
        .filter(Boolean)
        .join(' • ');

export type RepairForm = {
  name: string;
  phone: string;
  description: string;
  work: RepairWork;
  note: string;
  /** As typed; "0" for a free repair. */
  price: string;
  readyBy: string;
  deposit: string;
  method: RepairPayMethod;
};

export const emptyRepairForm = (readyBy: string): RepairForm => ({
  name: '',
  phone: '',
  description: '',
  work: 'resize',
  note: '',
  price: '',
  readyBy,
  deposit: '',
  method: 'cash',
});

/** What is still missing before the repair can be taken, or null. */
export function repairFormProblem(f: RepairForm): string | null {
  if (!f.name.trim()) return 'اكتب اسم الزبون';
  if (!f.phone.trim()) return 'اكتب رقم هاتف الزبون: يُتصل بها عندما تجهز القطعة';
  if (!f.description.trim()) return 'اكتب وصف القطعة';
  const price = parseThousandths(f.price);
  if (price === null || price < 0) return 'اكتب السعر المتفق عليه (0 للصيانة المجانية)';
  const deposit = f.deposit.trim() ? parseThousandths(f.deposit) : 0;
  if (deposit === null || deposit < 0) return 'مبلغ العربون غير صحيح';
  if (deposit > price) return `العربون أكبر من السعر المتفق عليه (${formatLyd(price)})`;
  return null;
}

export type RepairReminderRow = {
  key: 'late' | 'dueToday' | 'waiting';
  icon: 'clock.badge.exclamationmark' | 'calendar' | 'bag';
  title: string;
  repairs: Repair[];
};

/** The home reminders, in order of urgency. */
export function reminderRows(r: RepairReminders): RepairReminderRow[] {
  return (
    [
      {
        key: 'late',
        icon: 'clock.badge.exclamationmark',
        title: `متأخرة عن موعدها: ${r.late.length}`,
        repairs: r.late,
      },
      {
        key: 'dueToday',
        icon: 'calendar',
        title: `موعدها اليوم: ${r.dueToday.length}`,
        repairs: r.dueToday,
      },
      {
        key: 'waiting',
        icon: 'bag',
        title: `جاهزة ولم تُستلم: ${r.waiting.length}`,
        repairs: r.waiting,
      },
    ] as RepairReminderRow[]
  ).filter((row) => row.repairs.length > 0);
}

/** The printed repair ticket: its number, the piece and the work, the money and the shop note. */
export function repairTicketDoc(r: Repair, system: SystemId, note: string): ReceiptDoc {
  const made = new Date(r.createdAt);
  return {
    template: DEFAULT_TEMPLATE[system],
    showPrices: true,
    kind: 'repair',
    deposit: r.paid,
    receiptNo: r.ticketNo,
    date: `${made.getDate()}/${made.getMonth() + 1}/${made.getFullYear()}`,
    time: formatTime(made),
    customer: r.customerName,
    footer: [`${WORK_LABELS[r.work]}`, `Ready / جاهزة: ${r.readyBy}`, r.note, note]
      .filter(Boolean)
      .join('\n'),
    items: [{ name: r.description, quantity: 1, price: r.price }],
  };
}
