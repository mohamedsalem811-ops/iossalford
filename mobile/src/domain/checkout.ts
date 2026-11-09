import { cartProblems, lineTotal, problemMessage, type CartLine, type CartProblem } from './cart';
import { clean, nowMonth, nowStamp, RuleError, type Ctx } from './context';
import { ensureCustomer, hasIdentity } from './customers';
import { displayName, getProduct, moveStock } from './products';
import { issueReceipt, type Receipt, type TemplateId } from './receipts';
import { getRate } from './settings';

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

export type CheckoutInput = {
  cart: CartLine[];
  paymentMethod: PaymentMethod;
  customer?: { name?: string; phone?: string; area?: string };
  note?: string;
  template?: TemplateId;
  showPrices?: boolean;
};

export type CheckoutResult = { saleId: number; receipt: Receipt; total: number };

/**
 * Sells the whole cart, all-or-nothing: stock is checked again against the database, and if any
 * line can't be sold nothing is sold (CheckoutError lists every problem). On success one sale is
 * saved with a line per cart line (each keeping its own copy of name, code, brand, size, cost and
 * price), stock goes down with a "sale" move, and the receipt is issued with the next number.
 */
export function checkout(ctx: Ctx, input: CheckoutInput): CheckoutResult {
  const c = input.customer ?? {};
  if (input.paymentMethod === 'credit' && !hasIdentity(c.name, c.phone)) {
    throw new CheckoutError([{ kind: 'credit-needs-customer' }]);
  }
  return ctx.db.transaction(() => {
    const problems = cartProblems(input.cart, (id) => getProduct(ctx, id));
    if (problems.length) throw new CheckoutError(problems);

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
      `INSERT INTO sales (created_at, month, payment_method, customer_id, customer_name, note, rate, total, total_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    return { saleId, receipt, total };
  });
}
