/**
 * What the deposit screens show and check (I2), apart from the screens so it can be tested.
 */
import {
  minDeposit,
  etaText,
  STATUS_LABELS,
  type DepositRules,
  type Order,
  type OrderReminders,
} from '@/domain/orders';
import { parseThousandths } from '@/lib/digits';
import { formatLyd } from '@/lib/money';

/** "بانتظار الشراء", or "تم الشراء • الوصول 1/12/2026", or "متأخر منذ 1/12/2026". */
export function statusLine(o: Pick<Order, 'status' | 'eta'>, today: string): string {
  if (o.status === 'purchased' && o.eta)
    return o.eta < today
      ? `متأخر: كان متوقعاً ${etaText(o.eta)}`
      : `${STATUS_LABELS.purchased} • الوصول ${etaText(o.eta)}`;
  return STATUS_LABELS[o.status];
}

/** Late, or waiting for something to be done: shown in the warning colour. */
export const needsAttention = (o: Pick<Order, 'status' | 'eta'>, today: string) =>
  o.status === 'waiting' || (o.status === 'purchased' && !!o.eta && o.eta < today);

/** "عربون 500 د.ل من 1,000 د.ل • الباقي 500 د.ل" */
export const moneyLine = (o: Pick<Order, 'paid' | 'price' | 'remaining'>) =>
  `عربون ${formatLyd(o.paid)} من ${formatLyd(o.price)}${o.remaining > 0 ? ` • الباقي ${formatLyd(o.remaining)}` : ' • مدفوع بالكامل'}`;

export type OrderForm = {
  kind: 'order' | 'hold';
  name: string;
  phone: string;
  description: string;
  brand: string;
  category: string;
  size: string;
  color: string;
  note: string;
  /** The agreed price of one piece, as typed. */
  price: string;
  quantity: number;
  deposit: string;
  method: 'cash' | 'card' | 'transfer';
  productId: number | null;
};

export const emptyOrderForm = (kind: 'order' | 'hold' = 'order'): OrderForm => ({
  kind,
  name: '',
  phone: '',
  description: '',
  brand: '',
  category: '',
  size: '',
  color: '',
  note: '',
  price: '',
  quantity: 1,
  deposit: '',
  method: 'cash',
  productId: null,
});

/** The agreed price of the whole order from the form (a hold: the piece's price), or null. */
export function formPrice(f: OrderForm, piecePrice: number | null): number | null {
  const unit = f.kind === 'hold' ? piecePrice : parseThousandths(f.price);
  return unit && unit > 0 ? unit * f.quantity : null;
}

/** What is still missing before the deposit can be taken, or null. */
export function orderFormProblem(f: OrderForm, piecePrice: number | null): string | null {
  if (!f.name.trim()) return 'اكتب اسم الزبون';
  if (!f.phone.trim()) return 'اكتب رقم هاتف الزبون: يُتصل بها عند وصول القطعة';
  if (f.kind === 'hold' && !f.productId) return 'اختر القطعة المحجوزة';
  if (f.kind === 'order' && !f.description.trim()) return 'اكتب القطعة المطلوبة';
  const price = formPrice(f, piecePrice);
  if (!price) return 'اكتب السعر المتفق عليه';
  const deposit = parseThousandths(f.deposit);
  if (!deposit || deposit <= 0) return 'اكتب مبلغ العربون';
  if (deposit > price) return `العربون أكبر من السعر المتفق عليه (${formatLyd(price)})`;
  return null;
}

/** The line under the deposit: the minimum, and whether this one needs the owner. */
export function depositHint(
  f: OrderForm,
  piecePrice: number | null,
  rules: Pick<DepositRules, 'minPercent'>,
  isOwner: boolean,
): { text: string; warn: boolean } | null {
  const price = formPrice(f, piecePrice);
  if (!price) return null;
  const least = minDeposit(price, rules);
  const deposit = parseThousandths(f.deposit) ?? 0;
  const under = deposit > 0 && deposit < least;
  return {
    text: `أقل عربون ${rules.minPercent}%: ${formatLyd(least)}${under && !isOwner ? ' • أقل من ذلك يحتاج موافقة المالك' : ''}`,
    warn: under,
  };
}

export type ReminderRow = {
  key: 'noDate' | 'late' | 'waiting';
  icon: 'cart' | 'clock.badge.exclamationmark' | 'shippingbox';
  title: string;
  orders: Order[];
};

/** The home reminders, in order of urgency; the not-bought ones only for the owner. */
export function reminderRows(r: OrderReminders, owner: boolean): ReminderRow[] {
  const rows: ReminderRow[] = [
    {
      key: 'late',
      icon: 'clock.badge.exclamationmark',
      title: `تأخر وصولها: ${r.late.length}`,
      orders: r.late,
    },
    {
      key: 'waiting',
      icon: 'shippingbox',
      title: `جاهزة ولم تُستلم: ${r.waiting.length}`,
      orders: r.waiting,
    },
  ];
  if (owner)
    rows.unshift({
      key: 'noDate',
      icon: 'cart',
      title: `لم تُشترَ من المورد بعد: ${r.noDate.length}`,
      orders: r.noDate,
    });
  return rows.filter((row) => row.orders.length > 0);
}
