/**
 * What the repair screens show and check (J3), apart from the screens so it can be tested.
 */
import { DEFAULT_TEMPLATE } from '@/domain/receipts';
import type { RepairService } from '@/domain/repair-services';
import {
  REPAIR_STATUS_LABELS,
  workText,
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
  /** The owner's services ticked (rule D), in the order ticked. */
  picked: number[];
  /** The owner's price typed for a service «السعر يحدده المالك» (the owner only). */
  ownerPrices: Record<number, string>;
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
  picked: [],
  ownerPrices: {},
});

/**
 * The price of the services ticked: the owner's fixed prices, and the owner's own price for a
 * service «السعر يحدده المالك» when the owner typed one; `pending`: how many wait for it.
 */
export function servicesTotal(
  f: Pick<RepairForm, 'picked' | 'ownerPrices'>,
  list: Pick<RepairService, 'id' | 'price'>[],
  owner: boolean,
): { price: number; pending: number; bad: boolean } {
  let price = 0;
  let pending = 0;
  let bad = false;
  for (const id of f.picked) {
    const s = list.find((x) => x.id === id);
    if (!s) continue;
    if (s.price !== null) price += s.price;
    else {
      const typed = owner ? (f.ownerPrices[id] ?? '').trim() : '';
      const p = typed ? parseThousandths(typed) : null;
      if (typed && (p === null || p < 0)) bad = true;
      if (p !== null && p >= 0) price += p;
      else pending += 1;
    }
  }
  return { price, pending, bad };
}

/** The services as `takeRepair` takes them. */
export const servicesInput = (
  f: Pick<RepairForm, 'picked' | 'ownerPrices'>,
  list: Pick<RepairService, 'id' | 'price'>[],
  owner: boolean,
) =>
  f.picked.map((id) => {
    const s = list.find((x) => x.id === id);
    const typed = owner && s?.price === null ? parseThousandths(f.ownerPrices[id] ?? '') : null;
    return typed !== null && typed >= 0 ? { serviceId: id, price: typed } : { serviceId: id };
  });

/** What is still missing before the repair can be taken, or null. */
export function repairFormProblem(
  f: RepairForm,
  list: Pick<RepairService, 'id' | 'price'>[] = [],
  owner = false,
): string | null {
  if (!f.name.trim()) return 'اكتب اسم الزبون';
  if (!f.phone.trim()) return 'اكتب رقم هاتف الزبون: يُتصل بها عندما تجهز القطعة';
  if (!f.description.trim()) return 'اكتب وصف القطعة';
  let price: number | null;
  if (list.length) {
    if (!f.picked.length) return 'اختر الخدمات المطلوبة';
    const t = servicesTotal(f, list, owner);
    if (t.bad) return 'سعر الخدمة غير صحيح';
    price = t.price;
  } else {
    price = parseThousandths(f.price);
    if (price === null || price < 0) return 'اكتب السعر المتفق عليه (0 للصيانة المجانية)';
  }
  const deposit = f.deposit.trim() ? parseThousandths(f.deposit) : 0;
  if (deposit === null || deposit < 0) return 'مبلغ العربون غير صحيح';
  if (deposit > price) return `العربون أكبر من السعر المتفق عليه (${formatLyd(price)})`;
  return null;
}

export type RepairReminderRow = {
  key: 'late' | 'needPrice' | 'dueToday' | 'waiting';
  icon: 'clock.badge.exclamationmark' | 'tag' | 'calendar' | 'bag';
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
        key: 'needPrice',
        icon: 'tag',
        title: `تنتظر سعر المالك: ${r.needPrice.length}`,
        repairs: r.needPrice,
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
    footer: [workText(r), `Ready / جاهزة: ${r.readyBy}`, r.note, note].filter(Boolean).join('\n'),
    items: [{ name: r.description, quantity: 1, price: r.price }],
  };
}
