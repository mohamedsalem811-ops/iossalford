/**
 * Loyalty points (feature 34, phase F3), switched off until the owner turns them on in Settings →
 * نقاط الولاء. A customer earns points on what they pay, and can pay part of a later cash or card
 * sale with them ("مدفوع بالنقاط", its own line, not a discount). On a credit sale, points come as
 * the debt is paid. A return takes back its share. Every change is a row in `loyalty_moves`; the
 * balance is their sum. The owner can adjust a balance, and the adjustment is logged.
 */
import { formatLyd } from '@/lib/money';

import { logAction } from './activity';
import { allow, clean, nowMonth, nowStamp, RuleError, type Ctx, who } from './context';
import { getSetting, setSetting } from './settings';

export type LoyaltyRules = {
  enabled: boolean;
  /** Dirhams paid for one point (10 دينار = 10_000). */
  spendPerPoint: number;
  /** What one point pays, in dirhams (0.1 دينار = 100). */
  pointValue: number;
  /** The fewest points a customer needs before paying with them. */
  minRedeem: number;
  /** The largest share of a sale points may pay, in percent. */
  maxShare: number;
};

/** Off, with sensible starting rules for when the owner turns them on. */
export const DEFAULT_LOYALTY: LoyaltyRules = {
  enabled: false,
  spendPerPoint: 10_000,
  pointValue: 100,
  minRedeem: 100,
  maxShare: 50,
};

const KEY = 'loyalty';

export function getLoyalty(ctx: Ctx): LoyaltyRules {
  try {
    const saved = JSON.parse(getSetting(ctx, KEY) ?? '{}') as Partial<LoyaltyRules>;
    return { ...DEFAULT_LOYALTY, ...saved };
  } catch {
    return DEFAULT_LOYALTY;
  }
}

const describe = (r: LoyaltyRules) =>
  r.enabled
    ? `نقاط الولاء: نقطة لكل ${formatLyd(r.spendPerPoint)}، النقطة بـ ${formatLyd(r.pointValue)}، من ${r.minRedeem} نقطة، حتى ${r.maxShare}% من البيعة`
    : 'نقاط الولاء متوقفة';

/** The owner sets the rules; each change is logged. */
export function setLoyalty(ctx: Ctx, changes: Partial<LoyaltyRules>): LoyaltyRules {
  allow(ctx, 'settings.edit');
  const old = getLoyalty(ctx);
  const next: LoyaltyRules = { ...old, ...changes };
  const whole = (n: number, min: number) => Number.isInteger(n) && n >= min;
  if (!whole(next.spendPerPoint, 1)) throw new RuleError('اكتب المبلغ الذي يكسب نقطة واحدة');
  if (!whole(next.pointValue, 1)) throw new RuleError('اكتب قيمة النقطة الواحدة');
  if (!whole(next.minRedeem, 1)) throw new RuleError('أقل عدد للاستخدام نقطة واحدة على الأقل');
  if (!whole(next.maxShare, 1) || next.maxShare > 100)
    throw new RuleError('نسبة الدفع بالنقاط من 1 إلى 100');
  if (JSON.stringify(next) === JSON.stringify(old)) return old;
  ctx.db.transaction(() => {
    setSetting(ctx, KEY, JSON.stringify(next));
    logAction(ctx, 'loyalty.set', describe(next), { from: old, to: next });
  });
  return next;
}

/** A customer's points now. */
export function pointsBalance(ctx: Ctx, customerId: number): number {
  return (
    ctx.db.get<{ p: number }>(
      'SELECT coalesce(sum(points), 0) p FROM loyalty_moves WHERE customer_id = ?',
      [customerId],
    )?.p ?? 0
  );
}

export type LoyaltyKind = 'earn' | 'redeem' | 'reverse' | 'adjust';
export const LOYALTY_LABELS: Record<LoyaltyKind, string> = {
  earn: 'نقاط مكتسبة',
  redeem: 'دفع بالنقاط',
  reverse: 'مرتجع',
  adjust: 'تعديل المالك',
};

export type LoyaltyMove = {
  id: number;
  kind: LoyaltyKind;
  points: number;
  value: number;
  saleId: number | null;
  note: string | null;
  createdAt: string;
};

/** A customer's points history, newest first. */
export function loyaltyMoves(ctx: Ctx, customerId: number, limit = 50): LoyaltyMove[] {
  return ctx.db
    .all<{
      id: number;
      kind: LoyaltyKind;
      points: number;
      value: number;
      sale_id: number | null;
      note: string | null;
      created_at: string;
    }>(
      `SELECT id, kind, points, value, sale_id, note, created_at FROM loyalty_moves
        WHERE customer_id = ? ORDER BY id DESC LIMIT ?`,
      [customerId, limit],
    )
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      points: r.points,
      value: r.value,
      saleId: r.sale_id,
      note: r.note,
      createdAt: r.created_at,
    }));
}

/** Points earned on an amount paid. */
export const pointsFor = (paid: number, rules: LoyaltyRules) =>
  paid > 0 ? Math.floor(paid / rules.spendPerPoint) : 0;

/**
 * The most points this customer may pay with on a sale of `total`: up to the owner's share of the
 * sale, never more than they have, and only once they have the minimum. Null: none.
 */
export function redeemable(
  ctx: Ctx,
  customerId: number | null | undefined,
  total: number,
  rules = getLoyalty(ctx),
): { points: number; value: number; balance: number } | null {
  if (!rules.enabled || !customerId || total <= 0) return null;
  const balance = pointsBalance(ctx, customerId);
  if (balance < rules.minRedeem) return null;
  const most = Math.floor((total * rules.maxShare) / 100 / rules.pointValue);
  const points = Math.min(balance, most);
  if (points < 1) return null;
  return { points, value: points * rules.pointValue, balance };
}

type MoveInput = {
  customerId: number;
  kind: LoyaltyKind;
  points: number;
  value?: number;
  saleId?: number | null;
  returnId?: number | null;
  paymentId?: number | null;
  note?: string | null;
};

/** Writes one move (nothing for 0 points). Called inside the sale, return or payment. */
function addMove(ctx: Ctx, m: MoveInput) {
  if (m.points === 0) return;
  ctx.db.run(
    `INSERT INTO loyalty_moves (customer_id, kind, points, value, sale_id, return_id, payment_id, note,
       created_at, month, by, by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      m.customerId,
      m.kind,
      m.points,
      m.value ?? 0,
      m.saleId ?? null,
      m.returnId ?? null,
      m.paymentId ?? null,
      clean(m.note),
      nowStamp(ctx),
      nowMonth(ctx),
      ...who(ctx),
    ],
  );
}

/**
 * At checkout (inside its transaction): checks and takes the points paying part of the sale.
 * Returns what they pay, in dirhams. Throws a RuleError the seller can read.
 */
export function redeemOnSale(
  ctx: Ctx,
  sale: { id: number; customerId: number | null; total: number; method: string },
  points: number,
): number {
  if (!points) return 0;
  const rules = getLoyalty(ctx);
  if (!rules.enabled) throw new RuleError('نقاط الولاء متوقفة');
  if (!Number.isInteger(points) || points < 0) throw new RuleError('عدد النقاط غير صحيح');
  if (!sale.customerId) throw new RuleError('الدفع بالنقاط لزبون مسجل فقط');
  if (sale.method === 'credit') throw new RuleError('لا يُدفع بالنقاط في البيع الآجل');
  const most = redeemable(ctx, sale.customerId, sale.total, rules);
  if (!most || points > most.points)
    throw new RuleError(
      most ? `يمكن استخدام ${most.points} نقطة على الأكثر في هذه البيعة` : 'لا تكفي نقاط الزبون',
    );
  const value = points * rules.pointValue;
  addMove(ctx, {
    customerId: sale.customerId,
    kind: 'redeem',
    points: -points,
    value,
    saleId: sale.id,
  });
  return value;
}

/** After a cash or card sale: the points for what the customer paid in money. */
export function earnOnSale(
  ctx: Ctx,
  sale: { id: number; customerId: number | null; paid: number; method: string },
) {
  const rules = getLoyalty(ctx);
  // A credit sale earns as it is paid (earnOnPayment).
  if (!rules.enabled || !sale.customerId || sale.method === 'credit') return;
  addMove(ctx, {
    customerId: sale.customerId,
    kind: 'earn',
    points: pointsFor(sale.paid, rules),
    saleId: sale.id,
  });
}

/** A debt payment earns its points (a credit sale earns once it is paid). */
export function earnOnPayment(
  ctx: Ctx,
  payment: { id: number; customerId: number; amount: number },
) {
  const rules = getLoyalty(ctx);
  if (!rules.enabled) return;
  addMove(ctx, {
    customerId: payment.customerId,
    kind: 'earn',
    points: pointsFor(payment.amount, rules),
    paymentId: payment.id,
    note: 'دفعة دين',
  });
}

/**
 * A return takes back its share of the sale's points: of the points earned, and the points that
 * paid for it come back. The share is the refund's part of what was paid in money. Points the
 * customer has already spent can't be taken back below zero.
 */
export function reverseOnReturn(ctx: Ctx, ret: { id: number; saleId: number; lineTotal: number }) {
  const sale = ctx.db.get<{
    customer_id: number | null;
    total: number;
  }>('SELECT customer_id, total FROM sales WHERE id = ?', [ret.saleId]);
  if (!sale?.customer_id || sale.total <= 0) return;
  const moves = ctx.db.all<{ kind: LoyaltyKind; points: number }>(
    `SELECT kind, points FROM loyalty_moves WHERE sale_id = ? OR return_id IN
       (SELECT r.id FROM returns r JOIN sale_lines l ON l.id = r.sale_line_id WHERE l.sale_id = ?)`,
    [ret.saleId, ret.saleId],
  );
  const earned = moves.filter((m) => m.kind === 'earn').reduce((s, m) => s + m.points, 0);
  const spent = -moves.filter((m) => m.kind === 'redeem').reduce((s, m) => s + m.points, 0);
  if (earned === 0 && spent === 0) return;
  // What this return's earlier siblings already moved, so the shares never add up past the sale.
  const done = ctx.db.all<{ points: number; note: string | null }>(
    `SELECT points, note FROM loyalty_moves WHERE kind = 'reverse' AND return_id IN
       (SELECT r.id FROM returns r JOIN sale_lines l ON l.id = r.sale_line_id WHERE l.sale_id = ?)`,
    [ret.saleId],
  );
  const doneEarned = done.filter((d) => d.note === 'earned').reduce((s, d) => s - d.points, 0);
  const doneSpent = done.filter((d) => d.note === 'spent').reduce((s, d) => s + d.points, 0);
  const share = Math.min(1, ret.lineTotal / sale.total);
  const takeBack = Math.min(earned - doneEarned, Math.round(earned * share));
  const giveBack = Math.min(spent - doneSpent, Math.round(spent * share));
  if (giveBack > 0)
    addMove(ctx, {
      customerId: sale.customer_id,
      kind: 'reverse',
      points: giveBack,
      returnId: ret.id,
      note: 'spent',
    });
  const left = pointsBalance(ctx, sale.customer_id);
  const take = Math.min(takeBack, Math.max(0, left));
  if (take > 0)
    addMove(ctx, {
      customerId: sale.customer_id,
      kind: 'reverse',
      points: -take,
      returnId: ret.id,
      note: 'earned',
    });
}

/** The owner adds or takes points by hand, with a reason; logged. */
export function adjustPoints(ctx: Ctx, customerId: number, delta: number, reason: string) {
  allow(ctx, 'loyalty.adjust');
  if (!Number.isInteger(delta) || delta === 0)
    throw new RuleError('اكتب عدد النقاط المضافة أو المنقوصة');
  const why = clean(reason);
  if (!why) throw new RuleError('اكتب سبب التعديل');
  ctx.db.transaction(() => {
    const c = ctx.db.get<{ name: string }>('SELECT name FROM customers WHERE id = ?', [customerId]);
    if (!c) throw new RuleError('الزبون غير موجود');
    const balance = pointsBalance(ctx, customerId);
    if (balance + delta < 0) throw new RuleError(`رصيد الزبون ${balance} نقطة فقط`);
    addMove(ctx, { customerId, kind: 'adjust', points: delta, note: why });
    logAction(
      ctx,
      'loyalty.adjust',
      `${delta > 0 ? 'إضافة' : 'خصم'} ${Math.abs(delta)} نقطة لـ «${c.name}»: ${why}`,
      { customerId, delta },
    );
  });
}

/** Points shown on the screens: "120 نقطة (12 د.ل)". */
export const pointsText = (points: number, rules: LoyaltyRules) =>
  `${points} نقطة (${formatLyd(points * rules.pointValue)})`;
