/**
 * Deposit orders (عربون, phase I1): a piece ordered from a supplier for a customer (Swarovski,
 * Tiffany, Pandora…), or a piece in stock held for her (حجز), paid in part now.
 *
 * The rules, agreed with the owner (2026-11-15):
 * - the deposit is at least the owner's minimum (50%) of the agreed price; less needs the owner;
 * - the agreed price is fixed once the deposit is taken, and is the piece's price at delivery
 *   (its list price, so not a discount: rewards still work and no approval is needed);
 * - an order goes بانتظار الشراء → تم الشراء من المورد (the owner: its cost and the expected
 *   date, which only he types or changes) → وصلت (it becomes a product, held for her) → سُلّمت
 *   (a sale at checkout, using the deposit), or ملغاة; a hold goes محجوزة → سُلّمت or ملغاة;
 * - cancelled before تم الشراء (and a hold, at any time): her balance (له رصيد) or a refund the
 *   way she paid; an employee needs the owner's approval on the spot;
 * - cancelled after تم الشراء: the shop keeps the deposit (income, owner only), or, as the
 *   owner's exception, it goes to her balance;
 * - staff take deposits, add payments, mark an order arrived and deliver it.
 *
 * Money: each payment and refund is an order payment by its method, in the shift's drawer when
 * in cash; moving a deposit to her balance is a customer payment with method 'order' (no money
 * moves); a kept deposit is the shop's income in the month it was cancelled; at delivery the sale
 * keeps the deposit it used (sales.deposit_used), so its money taken is total − points − deposit.
 */
import { dayKey } from '@/lib/dates';
import { latinDigits } from '@/lib/digits';
import { formatLyd, usdToLyd } from '@/lib/money';

import { logAction } from './activity';
import {
  allow,
  clean,
  nowMonth,
  nowStamp,
  ownerSays,
  pageSql,
  PermissionError,
  RuleError,
  type Ctx,
  type Page,
  who,
} from './context';
import { ensureCustomer, getCustomer, phoneKey } from './customers';
import { addToCart, type CartLine } from './cart';
import { CATEGORIES, displayName, getProduct, insertProduct, type Product } from './products';
import { issueReceipt, type Receipt, type TemplateId } from './receipts';
import { reservedOf } from './reserved';
import { DEFAULT_TEMPLATES, fill } from './templates';
import { getRate, getSetting, setSetting } from './settings';
import { shiftFor } from './shifts';
import { can, PERMISSIONS } from '@/staff/permissions';

export type OrderKind = 'order' | 'hold';
export type OrderStatus = 'waiting' | 'purchased' | 'arrived' | 'held' | 'delivered' | 'cancelled';
export type DepositMethod = 'cash' | 'card' | 'transfer';
export type CancelHow = 'balance' | 'refund' | 'keep';

export const DEPOSIT_METHODS: DepositMethod[] = ['cash', 'card', 'transfer'];
export const STATUS_LABELS: Record<OrderStatus, string> = {
  waiting: 'بانتظار الشراء',
  purchased: 'تم الشراء من المورد',
  arrived: 'وصلت',
  held: 'محجوزة',
  delivered: 'سُلّمت',
  cancelled: 'ملغاة',
};
/** Still waiting for its customer: money is held and the piece (if any) is hers. */
export const OPEN_STATUSES: OrderStatus[] = ['waiting', 'purchased', 'arrived', 'held'];
const OPEN_SQL = "('waiting', 'purchased', 'arrived', 'held')";

// ---------------------------------------------------------------- the owner's rules

export type DepositRules = {
  /** The smallest deposit, as a percent of the agreed price; less needs the owner. */
  minPercent: number;
  /** Printed on every deposit receipt. */
  policy: string;
  /** A piece arrived (or held) and not collected after this many days: a reminder. */
  remindDays: number;
};

export const DEFAULT_DEPOSITS: DepositRules = {
  minPercent: 50,
  policy:
    'العربون يُسترد قبل طلب القطعة من المورد، ولا يُسترد بعد طلبها. عربون حجز قطعة موجودة يُسترد.',
  remindDays: 14,
};
export const DEPOSITS_KEY = 'deposits';

export function getDepositRules(ctx: Ctx): DepositRules {
  try {
    const saved = JSON.parse(getSetting(ctx, DEPOSITS_KEY) ?? '{}') as Partial<DepositRules>;
    return { ...DEFAULT_DEPOSITS, ...saved };
  } catch {
    return DEFAULT_DEPOSITS;
  }
}

/** The owner changes the minimum, the policy line or the reminder days; logged. */
export function setDepositRules(ctx: Ctx, changes: Partial<DepositRules>): DepositRules {
  allow(ctx, 'settings.edit');
  const next = { ...getDepositRules(ctx), ...changes };
  if (!Number.isInteger(next.minPercent) || next.minPercent < 1 || next.minPercent > 100)
    throw new RuleError('أقل عربون من 1 إلى 100%');
  if (!Number.isInteger(next.remindDays) || next.remindDays < 1 || next.remindDays > 90)
    throw new RuleError('أيام التذكير من 1 إلى 90');
  next.policy = (next.policy ?? '').trim().slice(0, 300);
  if (!next.policy) throw new RuleError('اكتب سياسة العربون التي تُطبع على الإيصال');
  ctx.db.transaction(() => {
    setSetting(ctx, DEPOSITS_KEY, JSON.stringify(next));
    logAction(
      ctx,
      'deposits.rules',
      `قواعد العربون: أقل عربون ${next.minPercent}%، التذكير بعد ${next.remindDays} يوماً`,
      { ...next },
    );
  });
  return next;
}

/** The smallest deposit for a price, in dirhams (rounded up to a whole dirham). */
export const minDeposit = (price: number, rules: Pick<DepositRules, 'minPercent'>) =>
  Math.ceil((price * rules.minPercent) / 100);

// ---------------------------------------------------------------- reading

export type Order = {
  id: number;
  kind: OrderKind;
  status: OrderStatus;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  description: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  color: string | null;
  note: string | null;
  imageFile: string | null;
  productId: number | null;
  quantity: number;
  /** The agreed price for all of it, in dirhams. */
  price: number;
  /** Paid towards it so far, less refunds. */
  paid: number;
  /** What is left to pay at delivery. */
  remaining: number;
  /** Entered by the owner at "purchased" (only the owner's screens show it). */
  cost: number | null;
  costUsd: number | null;
  /** The expected arrival date "2026-12-01". */
  eta: string | null;
  purchasedAt: string | null;
  arrivedAt: string | null;
  deliveredAt: string | null;
  saleId: number | null;
  cancelledAt: string | null;
  cancelHow: CancelHow | null;
  /** On cancelling: what was refunded, moved to her balance or kept. */
  settled: number;
  approvedBy: string | null;
  cancelApprovedBy: string | null;
  createdAt: string;
  byName: string | null;
};

type OrderRow = {
  id: number;
  kind: OrderKind;
  status: OrderStatus;
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  description: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  color: string | null;
  note: string | null;
  image_file: string | null;
  product_id: number | null;
  quantity: number;
  price: number;
  paid: number;
  cost: number | null;
  cost_usd: number | null;
  eta: string | null;
  purchased_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  sale_id: number | null;
  cancelled_at: string | null;
  cancel_how: CancelHow | null;
  settled: number;
  approved_by: string | null;
  cancel_approved_by: string | null;
  created_at: string;
  by_name: string | null;
};

const PAID_SQL = `coalesce((SELECT sum(CASE p.kind WHEN 'pay' THEN p.amount ELSE -p.amount END)
                              FROM order_payments p WHERE p.order_id = o.id), 0)`;
const SELECT = `SELECT o.*, c.name customer_name, c.phone customer_phone, ${PAID_SQL} paid
                  FROM orders o JOIN customers c ON c.id = o.customer_id`;

function toOrder(r: OrderRow): Order {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    description: r.description,
    brand: r.brand,
    category: r.category,
    size: r.size,
    color: r.color,
    note: r.note,
    imageFile: r.image_file,
    productId: r.product_id,
    quantity: r.quantity,
    price: r.price,
    paid: r.paid,
    remaining: Math.max(0, r.price - r.paid),
    cost: r.cost,
    costUsd: r.cost_usd,
    eta: r.eta,
    purchasedAt: r.purchased_at,
    arrivedAt: r.arrived_at,
    deliveredAt: r.delivered_at,
    saleId: r.sale_id,
    cancelledAt: r.cancelled_at,
    cancelHow: r.cancel_how,
    settled: r.settled,
    approvedBy: r.approved_by,
    cancelApprovedBy: r.cancel_approved_by,
    createdAt: r.created_at,
    byName: r.by_name,
  };
}

export function getOrder(ctx: Ctx, id: number): Order | undefined {
  const r = ctx.db.get<OrderRow>(`${SELECT} WHERE o.id = ?`, [id]);
  return r ? toOrder(r) : undefined;
}

function requireOrder(ctx: Ctx, id: number): Order {
  const o = getOrder(ctx, id);
  if (!o) throw new RuleError('الطلب غير موجود');
  return o;
}

export type OrderQuery = {
  /** 'open': still waiting for the customer (the default); 'done': delivered or cancelled. */
  show?: 'open' | 'done' | 'all';
  status?: OrderStatus;
  customerId?: number;
  /** The customer's name or phone, or what was ordered. */
  search?: string;
};

function orderFilter(q: OrderQuery) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  const show = q.show ?? 'open';
  if (show === 'open') where.push(`o.status IN ${OPEN_SQL}`);
  if (show === 'done') where.push(`o.status NOT IN ${OPEN_SQL}`);
  if (q.status) {
    where.push('o.status = ?');
    params.push(q.status);
  }
  if (q.customerId) {
    where.push('o.customer_id = ?');
    params.push(q.customerId);
  }
  const s = clean(latinDigits(q.search ?? ''));
  if (s) {
    const key = phoneKey(s);
    where.push(
      `(c.name LIKE ? OR o.description LIKE ? OR o.brand LIKE ?${key ? ' OR c.phone_key LIKE ?' : ''})`,
    );
    params.push(`%${s}%`, `%${s}%`, `%${s}%`, ...(key ? [`%${key}%`] : []));
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/**
 * The orders list, open ones by expected date (none first, so they get one), the rest newest
 * first. Long lists ask for a page at a time.
 */
export function listOrders(ctx: Ctx, q: OrderQuery = {}, page?: Page): Order[] {
  const f = orderFilter(q);
  const order =
    (q.show ?? 'open') === 'open'
      ? 'ORDER BY o.eta IS NOT NULL, o.eta, o.id'
      : 'ORDER BY coalesce(o.delivered_at, o.cancelled_at, o.created_at) DESC, o.id DESC';
  return ctx.db
    .all<OrderRow>(`${SELECT} ${f.where} ${order}${pageSql(page)}`, f.params)
    .map(toOrder);
}

export function countOrders(ctx: Ctx, q: OrderQuery = {}): number {
  const f = orderFilter(q);
  return (
    ctx.db.get<{ n: number }>(
      `SELECT count(*) n FROM orders o JOIN customers c ON c.id = o.customer_id ${f.where}`,
      f.params,
    )?.n ?? 0
  );
}

export type OrderPayment = {
  id: number;
  kind: 'pay' | 'refund';
  amount: number;
  method: DepositMethod;
  receiptId: number | null;
  receiptNo: string | null;
  createdAt: string;
  byName: string | null;
};

export function orderPayments(ctx: Ctx, orderId: number): OrderPayment[] {
  return ctx.db
    .all<{
      id: number;
      kind: 'pay' | 'refund';
      amount: number;
      method: DepositMethod;
      receipt_id: number | null;
      receipt_no: string | null;
      created_at: string;
      by_name: string | null;
    }>(
      `SELECT p.*, r.receipt_no FROM order_payments p LEFT JOIN receipts r ON r.id = p.receipt_id
        WHERE p.order_id = ? ORDER BY p.id`,
      [orderId],
    )
    .map((p) => ({
      id: p.id,
      kind: p.kind,
      amount: p.amount,
      method: p.method,
      receiptId: p.receipt_id,
      receiptNo: p.receipt_no,
      createdAt: p.created_at,
      byName: p.by_name,
    }));
}

/** Deposits paid on orders still waiting for their customers: money the shop holds for them. */
export function depositsHeld(ctx: Ctx): { orders: number; amount: number } {
  return (
    ctx.db.get<{ orders: number; amount: number }>(
      `SELECT count(*) orders, coalesce(sum(${PAID_SQL}), 0) amount FROM orders o
        WHERE o.status IN ${OPEN_SQL}`,
    ) ?? { orders: 0, amount: 0 }
  );
}

export type OrderReminders = {
  /** Ordered and not bought from the supplier yet (no expected date). */
  noDate: Order[];
  /** Bought, and the expected date has passed. */
  late: Order[];
  /** Arrived (or held) and not collected after the owner's days. */
  waiting: Order[];
};

/** What the home screen reminds about (I1 rules; I2 shows them). */
export function orderReminders(ctx: Ctx): OrderReminders {
  const today = dayKey(ctx.now());
  const days = getDepositRules(ctx).remindDays;
  const before = new Date(ctx.now());
  before.setDate(before.getDate() - days);
  const since = dayKey(before);
  const all = (where: string, params: string[] = []) =>
    ctx.db.all<OrderRow>(`${SELECT} WHERE ${where} ORDER BY o.id`, params).map(toOrder);
  return {
    noDate: all("o.status = 'waiting'"),
    late: all("o.status = 'purchased' AND o.eta IS NOT NULL AND o.eta < ?", [today]),
    waiting: all(
      `(o.status = 'arrived' AND substr(o.arrived_at, 1, 10) <= ?)
        OR (o.status = 'held' AND substr(o.created_at, 1, 10) <= ?)`,
      [since, since],
    ),
  };
}

// ---------------------------------------------------------------- taking a deposit

/** The deposit is under the owner's minimum: the owner approves on the spot. */
export class DepositApprovalNeeded extends RuleError {
  constructor(message: string) {
    super(message);
    this.name = 'DepositApprovalNeeded';
  }
}

/** Cancelling needs the owner's approval on the spot. */
export class CancelApprovalNeeded extends RuleError {
  constructor(message: string) {
    super(message);
    this.name = 'CancelApprovalNeeded';
  }
}

export type OrderCustomer = { name: string; phone: string };

export type TakeOrderInput = {
  customer: OrderCustomer;
  deposit: { amount: number; method: DepositMethod };
  /** The owner's one-time approval for a deposit under the minimum. */
  approval?: string;
  template?: TemplateId;
  note?: string;
} & (
  | {
      kind: 'order';
      description: string;
      brand?: string;
      category?: string;
      size?: string;
      color?: string;
      imageFile?: string | null;
      /** The agreed price of one piece, in dirhams. */
      unitPrice: number;
      quantity?: number;
    }
  | { kind: 'hold'; productId: number; quantity?: number }
);

export type TakeOrderResult = { orderId: number; receipt: Receipt };

function checkMoney(amount: number, method: string, what: string) {
  if (!Number.isInteger(amount) || amount <= 0) throw new RuleError(`اكتب مبلغ ${what}`);
  if (!(DEPOSIT_METHODS as string[]).includes(method))
    throw new RuleError('اختر طريقة الدفع: كاش أو بطاقة أو تحويل');
}

const METHOD_LABELS: Record<DepositMethod, string> = {
  cash: 'كاش',
  card: 'بطاقة',
  transfer: 'تحويل',
};

/**
 * Takes a deposit for an ordered piece or a held one, and issues its deposit receipt. The
 * customer needs a name and a phone (the shop calls her when the piece is ready). A held piece
 * must be available (stock − pieces already held).
 */
export function takeOrder(ctx: Ctx, input: TakeOrderInput): TakeOrderResult {
  const actor = allow(ctx, 'orders.take');
  const name = clean(input.customer.name);
  if (!name) throw new RuleError('اكتب اسم الزبون');
  if (!phoneKey(input.customer.phone))
    throw new RuleError('اكتب رقم هاتف الزبون: يُتصل بها عند وصول القطعة');
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99)
    throw new RuleError('الكمية من 1 إلى 99');
  checkMoney(input.deposit.amount, input.deposit.method, 'العربون');
  return ctx.db.transaction(() => {
    let product: Product | undefined;
    let unitPrice: number;
    let description: string;
    if (input.kind === 'hold') {
      product = getProduct(ctx, input.productId);
      if (!product || product.archived) throw new RuleError('القطعة غير موجودة');
      const free = product.stock - reservedOf(ctx, product.id);
      if (quantity > free)
        throw new RuleError(
          free > 0
            ? `المتوفر للحجز ${free} فقط من «${product.name}»`
            : `«${product.name}» غير متوفرة للحجز`,
        );
      unitPrice = product.price;
      description = product.name;
    } else {
      description = clean(input.description) ?? '';
      if (!description) throw new RuleError('اكتب القطعة المطلوبة');
      if (description.length > 200) throw new RuleError('وصف القطعة طويل (200 حرف على الأكثر)');
      unitPrice = input.unitPrice;
    }
    if (!Number.isInteger(unitPrice) || unitPrice <= 0)
      throw new RuleError('اكتب السعر المتفق عليه');
    const price = unitPrice * quantity;
    const amount = input.deposit.amount;
    if (amount > price)
      throw new RuleError(`العربون أكبر من السعر المتفق عليه (${formatLyd(price)})`);
    const rules = getDepositRules(ctx);
    const least = minDeposit(price, rules);
    // Checked before the approval is used, and the approval last (it is used up only by a deposit
    // that is otherwise ready).
    const shiftId = shiftFor(ctx, actor);
    let approvedBy: string | null = null;
    if (amount < least) {
      const says = ownerSays(ctx, 'deposit', input.approval);
      if (!says)
        throw new DepositApprovalNeeded(
          `أقل عربون ${rules.minPercent}% (${formatLyd(least)}): عربون ${formatLyd(amount)} يحتاج موافقة المالك.`,
        );
      if (says === 'approved') approvedBy = 'owner';
    }
    const customerId = ensureCustomer(ctx, name, input.customer.phone)!;
    const stamp = nowStamp(ctx);
    const brand = input.kind === 'order' ? clean(input.brand) : product!.brand;
    const id = ctx.db.run(
      `INSERT INTO orders (kind, status, customer_id, description, brand, category, size, color, note, image_file,
         product_id, quantity, price, approved_by, created_at, month, by, by_name, shift_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.kind,
        input.kind === 'hold' ? 'held' : 'waiting',
        customerId,
        description,
        brand,
        input.kind === 'order' ? clean(input.category) : product!.category,
        input.kind === 'order' ? clean(input.size && latinDigits(input.size)) : product!.size,
        input.kind === 'order' ? clean(input.color) : product!.color,
        clean(input.note),
        input.kind === 'order' ? (input.imageFile ?? null) : null,
        product?.id ?? null,
        quantity,
        price,
        approvedBy,
        stamp,
        nowMonth(ctx),
        ...who(ctx),
        shiftId,
      ],
    ).lastInsertRowId;
    const receipt = payTowards(ctx, requireOrder(ctx, id), amount, input.deposit.method, shiftId, {
      template: input.template,
      code: product?.sku ?? null,
    });
    logAction(
      ctx,
      input.kind === 'hold' ? 'order.hold' : 'order.take',
      `${input.kind === 'hold' ? 'حجز' : 'طلب'} رقم ${id} لـ «${name}»: «${description}» بـ ${formatLyd(price)}، عربون ${formatLyd(amount)} (${METHOD_LABELS[input.deposit.method]})${approvedBy ? ' بموافقة المالك' : ''}`,
      {
        orderId: id,
        customerId,
        price,
        deposit: amount,
        method: input.deposit.method,
        receipt: receipt.receiptNo,
        ...(product ? { productId: product.id } : {}),
        ...(approvedBy ? { approvedBy } : {}),
      },
    );
    return { orderId: id, receipt };
  });
}

/** Writes a payment towards an order and its deposit receipt (inside a checked action). */
function payTowards(
  ctx: Ctx,
  order: Order,
  amount: number,
  method: DepositMethod,
  shiftId: number | null,
  options: { template?: TemplateId; code?: string | null } = {},
): Receipt {
  const payId = ctx.db.run(
    `INSERT INTO order_payments (order_id, kind, amount, method, created_at, month, by, by_name, shift_id)
     VALUES (?, 'pay', ?, ?, ?, ?, ?, ?, ?)`,
    [order.id, amount, method, nowStamp(ctx), nowMonth(ctx), ...who(ctx), shiftId],
  ).lastInsertRowId;
  const paid = order.paid + amount;
  const code =
    options.code ?? (order.productId ? (getProduct(ctx, order.productId)?.sku ?? null) : null);
  const receipt = issueReceipt(ctx, {
    kind: 'deposit',
    orderId: order.id,
    deposit: paid,
    customer: order.customerName,
    template: options.template,
    footer: `${order.kind === 'hold' ? 'حجز' : 'طلب'} رقم ${order.id}\n${getDepositRules(ctx).policy}`,
    items: [
      {
        name: order.description,
        brand: order.brand,
        color: order.color,
        code,
        quantity: order.quantity,
        price: order.price / order.quantity,
      },
    ],
  });
  ctx.db.run('UPDATE order_payments SET receipt_id = ? WHERE id = ?', [receipt.id, payId]);
  return receipt;
}

/** Another payment towards an order (before delivery), with its own deposit receipt. */
export function addOrderPayment(
  ctx: Ctx,
  orderId: number,
  payment: { amount: number; method: DepositMethod; template?: TemplateId },
): Receipt {
  const actor = allow(ctx, 'orders.take');
  checkMoney(payment.amount, payment.method, 'الدفعة');
  return ctx.db.transaction(() => {
    const order = requireOrder(ctx, orderId);
    if (!OPEN_STATUSES.includes(order.status)) throw new RuleError('الطلب مُغلق');
    if (payment.amount > order.remaining)
      throw new RuleError(`المبلغ أكبر من الباقي (${formatLyd(order.remaining)})`);
    const shiftId = shiftFor(ctx, actor);
    const receipt = payTowards(ctx, order, payment.amount, payment.method, shiftId, {
      template: payment.template,
    });
    logAction(
      ctx,
      'order.pay',
      `دفعة ${formatLyd(payment.amount)} (${METHOD_LABELS[payment.method]}) على الطلب رقم ${orderId} لـ «${order.customerName}»`,
      { orderId, amount: payment.amount, method: payment.method, receipt: receipt.receiptNo },
    );
    return receipt;
  });
}

// ---------------------------------------------------------------- the stages

/** "2026-12-01" from what was typed (Arabic digits allowed); throws when it is not a real date. */
export function parseEta(text: string): string {
  const t = latinDigits(text.trim()).replace(/\//g, '-');
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const back = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  if (!m || !back || back.getMonth() !== Number(m[2]) - 1 || back.getDate() !== Number(m[3]))
    throw new RuleError('اكتب تاريخ الوصول المتوقع مثل 2026-12-01');
  return dayKey(back);
}

/**
 * The owner bought the piece from the supplier: its cost (in dinars, or in dollars at today's
 * rate) and the expected arrival date. The deposit is not refundable from now on.
 */
export function markPurchased(
  ctx: Ctx,
  orderId: number,
  input: { cost?: number; costUsd?: number | null; eta: string },
) {
  allow(ctx, 'orders.purchase');
  const eta = parseEta(input.eta);
  if (eta < dayKey(ctx.now())) throw new RuleError('تاريخ الوصول المتوقع قبل اليوم');
  const usd = input.costUsd ?? null;
  if (usd !== null && (!Number.isInteger(usd) || usd < 0)) throw new RuleError('التكلفة غير صحيحة');
  if (usd === null && (!Number.isInteger(input.cost) || (input.cost ?? -1) < 0))
    throw new RuleError('اكتب تكلفة القطعة');
  ctx.db.transaction(() => {
    const order = requireOrder(ctx, orderId);
    if (order.kind !== 'order' || order.status !== 'waiting')
      throw new RuleError('هذا الطلب ليس بانتظار الشراء');
    const rate = getRate(ctx);
    const cost = usd !== null ? usdToLyd(usd, rate) : input.cost!;
    ctx.db.run(
      `UPDATE orders SET status = 'purchased', cost = ?, cost_usd = ?, cost_rate = ?, eta = ?, purchased_at = ?,
         updated_at = ? WHERE id = ?`,
      [cost, usd, usd !== null ? rate : null, eta, nowStamp(ctx), nowStamp(ctx), orderId],
    );
    logAction(
      ctx,
      'order.purchase',
      `تم شراء الطلب رقم ${orderId} لـ «${order.customerName}» من المورد، الوصول المتوقع ${eta}`,
      { orderId, cost, ...(usd !== null ? { costUsd: usd } : {}), eta },
    );
  });
}

/** The owner changes the expected arrival date (only he types it; staff see it). */
export function setEta(ctx: Ctx, orderId: number, text: string) {
  allow(ctx, 'orders.purchase');
  const eta = parseEta(text);
  ctx.db.transaction(() => {
    const order = requireOrder(ctx, orderId);
    if (order.status !== 'purchased') throw new RuleError('يُحدد موعد الوصول بعد شراء القطعة');
    ctx.db.run('UPDATE orders SET eta = ?, updated_at = ? WHERE id = ?', [
      eta,
      nowStamp(ctx),
      orderId,
    ]);
    logAction(
      ctx,
      'order.eta',
      `موعد وصول الطلب رقم ${orderId}: ${eta}${order.eta ? ` (كان ${order.eta})` : ''}`,
      { orderId, eta, was: order.eta },
    );
  });
}

/**
 * The ordered piece arrived: it becomes a product in stock at the agreed price and the owner's
 * cost, held for its customer until she collects it.
 */
export function markArrived(ctx: Ctx, orderId: number): number {
  allow(ctx, 'orders.deliver');
  return ctx.db.transaction(() => {
    const order = requireOrder(ctx, orderId);
    if (order.kind !== 'order' || order.status !== 'purchased')
      throw new RuleError('تُستلم القطعة بعد شرائها من المورد');
    const categories: readonly string[] = CATEGORIES[ctx.system];
    const category =
      order.category && categories.includes(order.category) ? order.category : 'أخرى';
    const productId = insertProduct(
      ctx,
      {
        name: order.description,
        brand: order.brand,
        category,
        size: order.size,
        color: order.color,
        cost: Math.round((order.cost ?? 0) / order.quantity),
        price: order.price / order.quantity,
        stock: order.quantity,
        lowStock: 0,
        imageFile: order.imageFile,
      },
      `طلب رقم ${orderId}`,
    );
    ctx.db.run(
      "UPDATE orders SET status = 'arrived', product_id = ?, arrived_at = ?, updated_at = ? WHERE id = ?",
      [productId, nowStamp(ctx), nowStamp(ctx), orderId],
    );
    logAction(
      ctx,
      'order.arrive',
      `وصل الطلب رقم ${orderId} لـ «${order.customerName}»: «${order.description}»`,
      { orderId, productId },
    );
    return productId;
  });
}

// ---------------------------------------------------------------- cancelling

/** Before the piece was bought (or a hold): the deposit can go back. */
export const refundable = (o: Pick<Order, 'kind' | 'status'>) =>
  o.kind === 'hold' || o.status === 'waiting';

/**
 * Cancels an open order. Before it was bought (and a hold, at any time): the deposit goes to her
 * balance or back the way she paid; an employee needs the owner's approval. After it was bought:
 * the owner keeps it (income), or moves it to her balance as an exception.
 */
export function cancelOrder(
  ctx: Ctx,
  orderId: number,
  input: { how: CancelHow; approval?: string; reason?: string },
): { settled: number } {
  const actor = allow(ctx, 'orders.cancel');
  return ctx.db.transaction(() => {
    const order = requireOrder(ctx, orderId);
    if (!OPEN_STATUSES.includes(order.status)) throw new RuleError('الطلب مُغلق');
    const early = refundable(order);
    if (early && input.how === 'keep')
      throw new RuleError('العربون يُسترد قبل شراء القطعة: إلى رصيدها أو بطريقة الدفع');
    if (!early && input.how === 'refund')
      throw new RuleError('لا يُسترد العربون بعد شراء القطعة من المورد');
    if (!early && !can(actor, 'orders.purchase'))
      throw new PermissionError(
        `إلغاء طلب بعد شرائه: ${PERMISSIONS['orders.purchase']}، للمالك فقط.`,
      );
    const shiftId = input.how === 'refund' ? shiftFor(ctx, actor) : null;
    let approvedBy: string | null = null;
    if (early) {
      // Checked last: the approval is used up only by a cancel that is otherwise ready.
      const says = ownerSays(ctx, 'orderCancel', input.approval);
      if (!says)
        throw new CancelApprovalNeeded(
          `إلغاء ${order.kind === 'hold' ? 'الحجز' : 'الطلب'} رقم ${orderId} وإرجاع العربون: يحتاج موافقة المالك.`,
        );
      if (says === 'approved') approvedBy = 'owner';
    }
    const settled = order.paid;
    const stamp = nowStamp(ctx);
    let paymentId: number | null = null;
    if (input.how === 'refund') {
      // Back the way she paid: each method gets back what it paid.
      for (const m of ctx.db.all<{ method: DepositMethod; t: number }>(
        `SELECT method, sum(CASE kind WHEN 'pay' THEN amount ELSE -amount END) t FROM order_payments
          WHERE order_id = ? GROUP BY method HAVING t > 0 ORDER BY method`,
        [orderId],
      ))
        ctx.db.run(
          `INSERT INTO order_payments (order_id, kind, amount, method, note, created_at, month, by, by_name, shift_id)
           VALUES (?, 'refund', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderId, m.t, m.method, clean(input.reason), stamp, nowMonth(ctx), ...who(ctx), shiftId],
        );
    } else if (input.how === 'balance' && settled > 0) {
      // No money moves: the deposit stays in the shop, and the shop now owes it to her.
      paymentId = ctx.db.run(
        `INSERT INTO payments (customer_id, amount, method, note, created_at, month, by, by_name)
         VALUES (?, ?, 'order', ?, ?, ?, ?, ?)`,
        [
          order.customerId,
          settled,
          `عربون ${order.kind === 'hold' ? 'الحجز' : 'الطلب'} رقم ${orderId}`,
          stamp,
          nowMonth(ctx),
          ...who(ctx),
        ],
      ).lastInsertRowId;
    }
    ctx.db.run(
      `UPDATE orders SET status = 'cancelled', cancelled_at = ?, cancel_how = ?, settled = ?, payment_id = ?,
         cancel_approved_by = ?, note = coalesce(?, note), updated_at = ? WHERE id = ?`,
      [stamp, input.how, settled, paymentId, approvedBy, clean(input.reason), stamp, orderId],
    );
    const what = {
      balance: `إلى رصيدها ${formatLyd(settled)}`,
      refund: `استرداد ${formatLyd(settled)}`,
      keep: `العربون ${formatLyd(settled)} للمحل`,
    }[input.how];
    logAction(
      ctx,
      'order.cancel',
      `إلغاء ${order.kind === 'hold' ? 'الحجز' : 'الطلب'} رقم ${orderId} لـ «${order.customerName}»: ${what}${approvedBy ? ' بموافقة المالك' : ''}`,
      { orderId, how: input.how, settled, ...(approvedBy ? { approvedBy } : {}) },
    );
    return { settled };
  });
}

// ---------------------------------------------------------------- delivery (used by checkout)

/** What checkout needs to deliver an order: checked inside its transaction. */
export function orderForDelivery(ctx: Ctx, orderId: number): Order {
  const order = requireOrder(ctx, orderId);
  if (order.status !== 'arrived' && order.status !== 'held')
    throw new RuleError(
      order.status === 'delivered'
        ? `الطلب رقم ${orderId} سُلّم بالفعل`
        : `الطلب رقم ${orderId} لم يصل بعد (${STATUS_LABELS[order.status]})`,
    );
  if (!order.productId) throw new RuleError('الطلب بلا قطعة');
  return order;
}

/** Marks the order delivered by its sale (inside checkout's transaction). */
export function deliveredBy(ctx: Ctx, orderId: number, saleId: number) {
  ctx.db.run(
    "UPDATE orders SET status = 'delivered', sale_id = ?, delivered_at = ?, updated_at = ? WHERE id = ?",
    [saleId, nowStamp(ctx), nowStamp(ctx), orderId],
  );
}

/** The order a sale delivered, if any (its id), for the sale's page (I2). */
export const orderOfSale = (ctx: Ctx, saleId: number): number | undefined =>
  ctx.db.get<{ id: number }>('SELECT id FROM orders WHERE sale_id = ?', [saleId])?.id;

/** The deposit receipts of an order, for the delivery receipt ("GR-2026-0012، GR-2026-0015"). */
export function depositReceiptNos(ctx: Ctx, orderId: number): string[] {
  return ctx.db
    .all<{ n: string }>(
      `SELECT r.receipt_no n FROM order_payments p JOIN receipts r ON r.id = p.receipt_id
        WHERE p.order_id = ? AND p.kind = 'pay' ORDER BY p.id`,
      [orderId],
    )
    .map((r) => r.n);
}

/** A sale that delivered an order was deleted: the order waits for her again. */
export function undeliver(ctx: Ctx, saleId: number) {
  ctx.db.run(
    `UPDATE orders SET status = CASE kind WHEN 'hold' THEN 'held' ELSE 'arrived' END, sale_id = NULL,
       delivered_at = NULL, updated_at = ? WHERE sale_id = ? AND status = 'delivered'`,
    [nowStamp(ctx), saleId],
  );
}

/** The customer of an order, for screens (name and phone). */
export const orderCustomer = (ctx: Ctx, order: Pick<Order, 'customerId'>) =>
  getCustomer(ctx, order.customerId);

// ---------------------------------------------------------------- for the screens

/**
 * The order's piece as a cart line for its delivery: at the agreed price (its list price here),
 * with the quantity ordered. Undefined when its piece is gone.
 */
export function orderCart(ctx: Ctx, order: Order): CartLine[] | undefined {
  if (!order.productId) return undefined;
  const p = getProduct(ctx, order.productId);
  if (!p) return undefined;
  const r = addToCart(
    [],
    { ...p, price: order.price / order.quantity, stock: order.quantity },
    displayName(ctx, p),
    order.quantity,
  );
  return 'cart' in r ? r.cart : undefined;
}

/** "2026-12-01" as people read it: "1/12/2026". */
export const etaText = (eta: string) => {
  const [y, m, d] = eta.split('-').map(Number);
  return `${d}/${m}/${y}`;
};

/** The WhatsApp message with the expected date (sent after the owner bought the piece). */
export const etaMessage = (
  o: Pick<Order, 'customerName' | 'description' | 'eta' | 'id'>,
  template = DEFAULT_TEMPLATES.orderEta,
) =>
  fill(template, {
    الاسم: o.customerName,
    القطعة: o.description,
    رقم: String(o.id),
    الموعد: o.eta ? etaText(o.eta) : 'قريباً',
  });

/**
 * The WhatsApp message when the piece is ready to collect, with what is left to pay; the same
 * fill-ins for the reminder of a piece still waiting.
 */
export const arrivedMessage = (
  o: Pick<Order, 'customerName' | 'description' | 'kind' | 'id' | 'remaining'>,
  template = DEFAULT_TEMPLATES.orderArrived,
) =>
  fill(template, {
    الاسم: o.customerName,
    طلبك: o.kind === 'hold' ? 'قطعتك المحجوزة' : 'طلبك',
    القطعة: o.description,
    رقم: String(o.id),
    الباقي: o.remaining > 0 ? `\nالباقي: ${formatLyd(o.remaining)}.` : '',
  });
