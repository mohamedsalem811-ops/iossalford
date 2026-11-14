import {
  cartDiscount,
  cartProblems,
  cartTotal,
  hasPercentOff,
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
import { ensureCustomer, hasIdentity, type SaleCustomerDetails } from './customers';
import { earnOnSale, getLoyalty, pointsBalance, redeemOnSale } from './loyalty';
import { getRewards, type RewardRules } from './rewards';
import { rewardCart, rewardStatus } from './visit-reward';
import { birthdayStatus, getBirthday } from './birthday';
import { countText, PURCHASES_LEFT } from '@/lib/arabic-count';
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

/**
 * The birthday was saved less than 30 days before it (H1): the owner approves the birthday
 * discount on the spot, then the screen checks out again with the approval.
 */
export class BirthdayApprovalNeeded extends RuleError {
  constructor(message: string) {
    super(message);
    this.name = 'BirthdayApprovalNeeded';
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
  customer?: { name?: string; phone?: string; area?: string; details?: SaleCustomerDetails };
  note?: string;
  template?: TemplateId;
  showPrices?: boolean;
  /** Why the price went down (required when the owner approves on the spot). */
  discountReason?: string;
  /** The owner's one-time approval for a discount over the limits. */
  approval?: string;
  /** Loyalty points the customer pays part of the sale with (F3; cash or card only). */
  points?: number;
  /** Use the customer's visit reward on this sale (G2). */
  reward?: boolean;
  /** Use the customer's birthday discount on this sale (H1). */
  birthday?: boolean;
  /** The owner's one-time approval for a birthday saved less than 30 days before it. */
  birthdayApproval?: string;
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
    // One reward a purchase, and never with another discount (the owner's rule, H1): an agreed
    // price under the list price is a discount too. Sets keep their own price and are allowed.
    if (input.reward && input.birthday)
      throw new RuleError('مكافأة واحدة في كل شراء: مكافأة الزيارة أو خصم عيد الميلاد');
    if (input.reward || input.birthday) {
      const priceOf = (id: number) => getProduct(ctx, id)?.price;
      if (policies.quickDiscounts.some((p) => hasPercentOff(input.cart, priceOf, p)))
        throw new RuleError('لا تُجمع المكافأة مع أزرار الخصم السريع');
      if (discount.total > 0)
        throw new RuleError('لا تُجمع المكافآت مع أي خصم آخر: أرجع الأسعار الأصلية أولاً');
    }
    let approvedBy: string | null = null;
    if (seller.kind !== 'owner' && needsApproval(discount)) {
      if (!reason) throw new ApprovalNeeded(discount, 'اختر سبب الخصم أو اكتبه.');
      // Checked last: an approval is used up only by a sale that is otherwise ready.
      if (ownerSays(ctx, 'discount', input.approval) !== 'approved')
        throw new ApprovalNeeded(discount, discountMessage(discount, policies));
      approvedBy = 'owner';
    }

    const customerId = ensureCustomer(ctx, c.name, c.phone, c.area, c.details);
    const customerName = clean(c.name);
    const stamp = nowStamp(ctx);
    // The visit reward (G2): set up by the owner in advance, so it needs no approval and is not
    // in the employee's discount limit above; it comes off the prices, so returns stay right.
    let cart = input.cart;
    let rewardOff = 0;
    if (input.reward) {
      const rules = getRewards(ctx);
      if (!rewardStatus(ctx, customerId, rules)?.ready)
        throw new RuleError('لا توجد مكافأة جاهزة لهذا الزبون');
      if (cartTotal(cart) < rules.minRewardSale)
        throw new RuleError(
          `تُستخدم المكافأة في بيعة من ${formatLyd(rules.minRewardSale)} أو أكثر`,
        );
      const r = rewardCart(cart, rules);
      cart = r.cart;
      rewardOff = r.off;
    }
    // The birthday discount (H1): the owner's own rules, so no approval and not in the employee's
    // limit, unless the birthday was saved less than 30 days before it.
    let birthdayOff = 0;
    let birthdayBy: 'owner' | 'approved' | null = null;
    if (input.birthday) {
      const rules = getBirthday(ctx);
      const status = birthdayStatus(ctx, customerId, rules);
      if (!status) throw new RuleError('لا يوجد خصم عيد ميلاد لهذا الزبون اليوم');
      if (status.used) throw new RuleError('استُخدم خصم عيد الميلاد لهذا الزبون هذه السنة');
      if (cartTotal(cart) < rules.minSale)
        throw new RuleError(
          `يُستخدم خصم عيد الميلاد في شراء من ${formatLyd(rules.minSale)} أو أكثر`,
        );
      if (status.needsOwner) {
        // Checked last: an approval is used up only by a sale that is otherwise ready.
        birthdayBy = ownerSays(ctx, 'birthday', input.birthdayApproval);
        if (!birthdayBy)
          throw new BirthdayApprovalNeeded(
            'تاريخ الميلاد سُجّل قبل أقل من 30 يوماً: خصم عيد الميلاد يحتاج موافقة المالك.',
          );
      }
      const r = rewardCart(cart, rules);
      cart = r.cart;
      birthdayOff = r.off;
    }
    const lines = cart.map((l) => {
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

    // Points paying part of the sale (F3): checked against the customer's points and the
    // owner's rules, then the rest earns new points.
    const pointsPaid = redeemOnSale(
      ctx,
      { id: saleId, customerId, total, method: input.paymentMethod },
      input.points ?? 0,
    );
    if (pointsPaid > 0)
      ctx.db.run('UPDATE sales SET points_paid = ? WHERE id = ?', [pointsPaid, saleId]);
    if (rewardOff > 0)
      ctx.db.run('UPDATE sales SET reward_off = ? WHERE id = ?', [rewardOff, saleId]);
    if (birthdayOff > 0)
      ctx.db.run('UPDATE sales SET birthday_off = ? WHERE id = ?', [birthdayOff, saleId]);
    earnOnSale(ctx, {
      id: saleId,
      customerId,
      paid: total - pointsPaid,
      method: input.paymentMethod,
    });

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
      pointsPaid,
      rewardOff,
      birthdayOff,
      footer: receiptFooter(ctx, customerId),
      items: lines.map(({ l, p }) => ({
        name: displayName(ctx, p),
        brand: p.brand,
        color: p.color,
        code: p.sku,
        specs: p.specs,
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
      }${rewardOff ? `، مكافأة الزيارة ${formatLyd(rewardOff)}` : ''}${
        birthdayOff
          ? `، خصم عيد الميلاد ${formatLyd(birthdayOff)}${birthdayBy === 'approved' ? ' بموافقة المالك' : ''}`
          : ''
      }${pointsPaid ? `، مدفوع بالنقاط ${formatLyd(pointsPaid)}` : ''}`,
      {
        saleId,
        total,
        pieces,
        ...(pointsPaid ? { pointsPaid } : {}),
        ...(rewardOff ? { rewardOff } : {}),
        ...(birthdayOff ? { birthdayOff, birthdayBy } : {}),
        payment: input.paymentMethod,
        receipt: receipt.receiptNo,
        ...(discount.total ? { discount: discount.total, reason, approvedBy } : {}),
      },
    );
    return { saleId, receipt, total };
  });
}

/**
 * What the receipt prints under the total (G2), kept with it so a receipt printed again later
 * never changes: the customer's points now, and how far the next visit reward is.
 */
export function receiptFooter(
  ctx: Ctx,
  customerId: number | null,
  rules: RewardRules = getRewards(ctx),
): string | null {
  if (!customerId) return null;
  const lines: string[] = [];
  if (getLoyalty(ctx).enabled)
    lines.push(`Points / رصيد النقاط: ${pointsBalance(ctx, customerId)}`);
  const status = rewardStatus(ctx, customerId, rules);
  if (status) {
    const left = status.every - status.count;
    lines.push(
      left <= 0
        ? `مكافأة ${rules.percent}% جاهزة في زيارتك القادمة 🎁`
        : `بقي ${countText(left, PURCHASES_LEFT)} على مكافأة ${rules.percent}%`,
    );
  }
  return lines.length ? lines.join('\n') : null;
}
