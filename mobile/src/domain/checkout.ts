import {
  cartDiscount,
  cartProblems,
  lineTotal,
  needsApproval,
  priceChanges,
  problemMessage,
  type CartDiscount,
  type CartLine,
  type CartProblem,
} from './cart';
import { getPolicies, type Policies } from './policies';
import { shiftFor } from './shifts';
import { allow, clean, nowMonth, nowStamp, ownerSays, RuleError, type Ctx } from './context';
import { ensureCustomer, hasIdentity } from './customers';
import { displayName, getProduct, moveStock } from './products';
import { issueReceipt, type Receipt, type TemplateId } from './receipts';
import { getSet, setForCart } from './sets';
import { getRate } from './settings';
import { actorKey, actorName } from '@/staff/model';
import { logAction } from './activity';
import { formatLyd } from '@/lib/money';

export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'credit'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'كاش',
  card: 'بطاقة',
  transfer: 'تحويل',
  credit: 'آجل',
};

export class CheckoutError extends RuleError {
  constructor(public readonly problems: CartProblem[]) {
    super(problems.map(problemMessage).join('\n'));
    this.name = 'CheckoutError';
  }
}

/**
 * The discount is over an employee limit and the owner has not approved it (phase S4). The
 * screen asks the owner on the spot, then checks out again with the approval.
 */
export class ApprovalNeeded extends RuleError {
  constructor(
    public readonly discount: CartDiscount,
    message: string,
  ) {
    super(message);
    this.name = 'ApprovalNeeded';
  }
}

export function discountMessage(d: CartDiscount, p: Policies): string {
  const parts: string[] = [];
  if (d.overPiece.length)
    parts.push(`خصم القطعة أكثر من ${formatLyd(p.discountPerPiece)} (${d.overPiece.join('، ')})`);
  if (d.overSale)
    parts.push(`خصم البيعة ${formatLyd(d.total)} أكثر من ${formatLyd(p.discountPerSale)}`);
  return `${parts.join('، و')}: يحتاج موافقة المالك.`;
}

export type CheckoutInput = {
  cart: CartLine[];
  paymentMethod: PaymentMethod;
  customer?: { name?: string; phone?: string; area?: string };
  note?: string;
  template?: TemplateId;
  showPrices?: boolean;
  /** Why the price went down (required when the owner approves on the spot). */
  discountReason?: string;
  /** The owner's one-time approval for a discount over the limits. */
  approval?: string;
};

export type CheckoutResult = { saleId: number; receipt: Receipt; total: number };

/**
 * Sells the whole cart, all-or-nothing: stock is checked again against the database, and if any
 * line can't be sold nothing is sold (CheckoutError lists every problem). On success one sale is
 * saved with a line per cart line (each keeping its own copy of name, code, brand, size, cost and
 * price), stock goes down with a "sale" move, and the receipt is issued with the next number.
 */
export function checkout(ctx: Ctx, input: CheckoutInput): CheckoutResult {
  const seller = allow(ctx, 'sales.create');
  const c = input.customer ?? {};
  if (input.paymentMethod === 'credit' && !hasIdentity(c.name, c.phone)) {
    throw new CheckoutError([{ kind: 'credit-needs-customer' }]);
  }
  return ctx.db.transaction(() => {
    const problems = cartProblems(input.cart, (id) => getProduct(ctx, id));
    if (problems.length) throw new CheckoutError(problems);
    // A kept cart can be hours old: never sell at a price that has changed since (audit F-1).
    const changed = priceChanges(
      input.cart,
      (id) => getProduct(ctx, id),
      (id) => {
        const set = getSet(ctx, id);
        return set ? setForCart(ctx, set) : undefined;
      },
    );
    if (changed.length) throw new CheckoutError(changed);
    // Before the approval below: a sale refused for no open shift must not use it up (F-7).
    const shiftId = shiftFor(ctx, seller);

    // Discounts over the employee limits need the owner, with a reason (phase S4).
    const policies = getPolicies(ctx);
    const discount = cartDiscount(input.cart, (id) => getProduct(ctx, id)?.price, policies);
    const reason = clean(input.discountReason);
    let approvedBy: string | null = null;
    if (seller.kind !== 'owner' && needsApproval(discount)) {
      if (!reason) throw new ApprovalNeeded(discount, 'اختر سبب الخصم أو اكتبه.');
      // Checked last: an approval is used up only by a sale that is otherwise ready.
      if (ownerSays(ctx, 'discount', input.approval) !== 'approved')
        throw new ApprovalNeeded(discount, discountMessage(discount, policies));
      approvedBy = 'owner';
    }

    const customerId = ensureCustomer(ctx, c.name, c.phone, c.area);
    const customerName = clean(c.name);
    const stamp = nowStamp(ctx);
    const lines = input.cart.map((l) => {
      const p = getProduct(ctx, l.productId)!;
      return { l, p, total: lineTotal(l), cost: p.cost * l.quantity };
    });
    const total = lines.reduce((t, x) => t + x.total, 0);
    const totalCost = lines.reduce((t, x) => t + x.cost, 0);

    const saleId = ctx.db.run(
      `INSERT INTO sales (created_at, month, payment_method, customer_id, customer_name, note, rate, total, total_cost, seller, seller_name,
         discount, discount_reason, approved_by, shift_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stamp,
        nowMonth(ctx),
        input.paymentMethod,
        customerId,
        customerName,
        clean(input.note),
        getRate(ctx),
        total,
        totalCost,
        actorKey(seller),
        actorName(seller),
        discount.total,
        discount.total > 0 ? reason : null,
        approvedBy,
        shiftId,
      ],
    ).lastInsertRowId;

    for (const { l, p, total: lt, cost } of lines) {
      const lineId = ctx.db.run(
        `INSERT INTO sale_lines (sale_id, product_id, name, sku, brand, category, size, color, quantity, unit_cost,
           list_price, unit_price, line_total, line_cost, set_id, set_name, bundle_group)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          p.id,
          displayName(ctx, p),
          p.sku,
          p.brand,
          p.category,
          p.size,
          p.color,
          l.quantity,
          p.cost,
          p.price,
          l.unitPrice,
          lt,
          cost,
          l.setId,
          l.setName,
          l.bundleGroup,
        ],
      ).lastInsertRowId;
      // Checked above inside the same transaction, so this cannot fail; guard anyway.
      if (!moveStock(ctx, p.id, -l.quantity, 'sale', lineId)) {
        throw new CheckoutError([
          { kind: 'stock', name: displayName(ctx, p), requested: l.quantity, available: p.stock },
        ]);
      }
    }

    const receipt = issueReceipt(ctx, {
      saleId,
      customer: customerName ?? undefined,
      template: input.template,
      showPrices: input.showPrices,
      items: lines.map(({ l, p }) => ({
        name: displayName(ctx, p),
        brand: p.brand,
        color: p.color,
        code: p.sku,
        quantity: l.quantity,
        // Bundle lines already carry their share of the set price per piece.
        price: l.unitPrice,
      })),
    });
    const pieces = input.cart.reduce((n, l) => n + l.quantity, 0);
    logAction(
      ctx,
      'sale.create',
      `بيعة رقم ${saleId}: ${pieces} قطعة بـ ${formatLyd(total)} (${PAYMENT_LABELS[input.paymentMethod]})${
        discount.total
          ? `، خصم ${formatLyd(discount.total)}${approvedBy ? ' بموافقة المالك' : ''}`
          : ''
      }`,
      {
        saleId,
        total,
        pieces,
        payment: input.paymentMethod,
        receipt: receipt.receiptNo,
        ...(discount.total ? { discount: discount.total, reason, approvedBy } : {}),
      },
    );
    return { saleId, receipt, total };
  });
}
