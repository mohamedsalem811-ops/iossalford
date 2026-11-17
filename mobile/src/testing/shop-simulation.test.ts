/**
 * @jest-environment node
 *
 * The shop simulation (J1, from the full check): 120 working days of a jewelry shop through the
 * app's own rules — an employee's shifts, sales (sets too, points, approved discounts), returns,
 * exchanges, debts and payments, deposits held and ordered, deliveries, cancellations, payouts,
 * deleted sales, the owner restocking — with an independent record kept alongside and compared
 * with the app's numbers every day: the drawer, the day summary, stock, debts and points; then
 * the month reports, the quarter's closing, receipt numbers, the activity log and the database.
 *
 * Any change to how money, stock or debts move must keep this green. A failure lists each
 * difference with its day. Longer runs: SEED=7 DAYS=365 BUSY=2 npx jest shop-simulation.
 */
import { addSet, addToCart, setUnitPrice, type CartLine } from '@/domain/cart';
import { exchange } from '@/domain/exchange';
import { checkout, type PaymentMethod } from '@/domain/checkout';
import { RuleError, type Ctx } from '@/domain/context';
import { customerByPhone } from '@/domain/customers';
import { daySummary } from '@/domain/day-summary';
import { balance, recordPayment, recordPayout } from '@/domain/debts';
import { addExpense } from '@/domain/expenses';
import { pointsBalance, redeemable, setLoyalty } from '@/domain/loyalty';
import {
  cancelOrder,
  getOrder,
  markArrived,
  markPurchased,
  orderCart,
  takeOrder,
} from '@/domain/orders';
import { adjustStock, displayName, getProduct, saveProduct } from '@/domain/products';
import { reservedCounts } from '@/domain/reserved';
import { summary } from '@/domain/reports';
import { getReceipt } from '@/domain/receipts';
import { addReturn, deleteSale, getSale, refundChoices, type RefundMethod } from '@/domain/sales';
import { getSet, saveSet, setForCart } from '@/domain/sets';
import { closeShift, openShift, shiftTotals, getShift } from '@/domain/shifts';
import { verifyLog } from '@/domain/activity';
import { closeQuarter } from '@/domain/closing';
import { EMPLOYEE, makeCtx, passing } from '@/domain/testing/ctx';
import { OWNER } from '@/staff/model';

// A small seeded random, so a failure can be repeated.
let seedState = Number(process.env.SEED ?? 20261117);
const rnd = () => {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
};
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const dk = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const PRODUCTS = Number(process.env.PRODUCTS ?? 250);
const DAYS = Number(process.env.DAYS ?? 120);
const PEOPLE = Array.from({ length: Number(process.env.PEOPLE ?? 300) }, (_, i) => ({
  name: `زبونة ${i + 1}`,
  phone: `091${String(1_000_000 + i)}`,
}));

it(`${DAYS} days of use: the app agrees with an independent record`, () => {
  const t = makeCtx('jewelry', new Date(2026, 0, 3, 9, 0), { autoShift: false });
  const ctx: Ctx = {
    db: t.db,
    system: 'jewelry',
    now: t.now,
    get actor() {
      return t.actor;
    },
    approvals: { take: (token) => token === 'ok' },
  };
  const problems: string[] = [];
  const fail = (day: string, what: string) => {
    if (problems.length < 60) problems.push(`${day}: ${what}`);
  };

  // The record kept beside the app.
  const stock = new Map<number, number>();
  const owed = new Map<number, number>(); // customer id -> what she owes (negative: shop owes her)
  const saleMonth = new Map<number, { month: string; total: number; cost: number }>();
  const refundMonth = new Map<string, number>();
  const refunded = (day: string, refund: number) =>
    refundMonth.set(day.slice(0, 7), (refundMonth.get(day.slice(0, 7)) ?? 0) + refund);
  /** Every receipt prints what was paid (a set's pieces in whole dinars, J1). */
  const receiptMatches = (day: string, saleId: number, receiptId: number) => {
    const sale = getSale(ctx, saleId)!;
    const receipt = getReceipt(ctx, receiptId)!;
    const lines = receipt.items.reduce((n, i) => n + i.price * i.quantity, 0);
    if (receipt.total !== sale.total || lines !== sale.total)
      fail(day, `sale ${saleId}: receipt ${receipt.total} (lines ${lines}) ≠ sale ${sale.total}`);
  };
  const errors = new Map<string, number>();
  const personOf = new Map<number, { name: string; phone: string }>();
  const unexpected = (e: unknown, where: string) => {
    const msg = e instanceof Error ? `${where}: ${e.message.split('\n')[0]}` : String(e);
    errors.set(msg, (errors.get(msg) ?? 0) + 1);
  };

  setLoyalty(ctx, { enabled: true });
  const productIds: number[] = [];
  for (let i = 1; i <= PRODUCTS; i++) {
    const price = 50_000 + Math.floor(rnd() * 40) * 25_000;
    const s = 3 + Math.floor(rnd() * 10);
    const id = saveProduct(ctx, {
      name: `قطعة ${i}`,
      brand: `ماركة ${1 + (i % 12)}`,
      category: 'خواتم',
      price,
      cost: Math.floor(price / 2),
      stock: s,
    });
    productIds.push(id);
    stock.set(id, s);
  }
  // Sets of 2 or 3 pieces, some with a discount that has dirhams in it.
  t.setActor(OWNER);
  const setIds = Array.from({ length: 12 }, (_, i) =>
    saveSet(ctx, {
      name: `طقم ${i + 1}`,
      discount: (10 + Math.floor(rnd() * 90)) * 1_000 + (i % 3 === 0 ? 500 : 0),
      items: Array.from({ length: 2 + (i % 2) }, (_, n) => ({
        productId: productIds[(i * 7 + n * 31) % productIds.length],
        quantity: n === 0 && i % 4 === 1 ? 2 : 1,
      })),
    }),
  );

  type Open = { orderId: number; customerId: number; productId: number | null; paid: number };
  const openOrders: Open[] = [];
  let sales = 0;
  let returns = 0;
  let deposits = 0;
  let deliveries = 0;
  let cancels = 0;
  let deletes = 0;
  let usedPoints = 0;
  let exchanges = 0;
  let payouts = 0;
  let restocks = 0;
  let setSales = 0;
  let otherWay = 0;
  /** A refund paid back: what leaves the drawer (cash), or what comes off what she owes. */
  const paidBack = (customerId: number | null, how: RefundMethod, refund: number) => {
    if (how === 'cash') return refund;
    if ((how === 'debt' || how === 'balance') && customerId)
      owed.set(customerId, (owed.get(customerId) ?? 0) - refund);
    return 0;
  };

  for (let day = 0; day < DAYS; day++) {
    const date = new Date(2026, 0, 3 + day, 9, 0);
    const key = dk(date);
    t.setNow(date);
    // Each Saturday the owner restocks what is running low.
    if (day % 7 === 0) {
      t.setActor(OWNER);
      for (const id of productIds) {
        const p = getProduct(ctx, id);
        if (p && !p.archived && p.stock < 3) {
          try {
            adjustStock(ctx, id, 8, 'وصلت بضاعة');
          } catch (e) {
            if (e instanceof RuleError) continue;
            throw e;
          }
          stock.set(id, stock.get(id)! + 8);
          restocks++;
        }
      }
    }
    // The employee opens her shift.
    t.setActor(EMPLOYEE);
    const opening = 5_000_000;
    const shiftId = openShift(ctx, opening);
    let drawer = opening; // our own count of the cash that should be in the drawer
    const todaysSales: { saleId: number; method: PaymentMethod; customerId: number | null }[] = [];

    const steps = Math.round((18 + Math.floor(rnd() * 15)) * Number(process.env.BUSY ?? 1));
    for (let step = 0; step < steps; step++) {
      t.setNow(new Date(date.getTime() + Math.floor(((step + 1) * 10 * 3_600_000) / (steps + 1))));
      const roll = rnd();
      try {
        if (roll < 0.62) {
          // A sale.
          let cart: CartLine[] = [];
          const asSet = rnd() < 0.1;
          if (asSet) {
            const set = setForCart(ctx, getSet(ctx, pick(setIds))!);
            const held = reservedCounts(ctx);
            const free = set.items.every(
              (i) => !!i.product && i.product.stock - (held.get(i.product.id) ?? 0) >= i.quantity,
            );
            const r = free ? addSet([], set) : null;
            if (r && 'cart' in r) cart = r.cart;
          }
          const lines = asSet ? 0 : 1 + Math.floor(rnd() * 3);
          for (let l = 0; l < lines; l++) {
            const id = pick(productIds);
            const p = getProduct(ctx, id);
            if (!p || p.archived) continue;
            const held = reservedCounts(ctx).get(id) ?? 0;
            const inCart = cart
              .filter((c) => c.productId === id)
              .reduce((n, c) => n + c.quantity, 0);
            if (p.stock - held - inCart < 1) continue;
            const r = addToCart(cart, p, displayName(ctx, p), 1);
            if ('cart' in r) cart = r.cart;
          }
          if (!cart.length) continue;
          const method = pick<PaymentMethod>([
            'cash',
            'cash',
            'cash',
            'card',
            'transfer',
            'credit',
          ]);
          const person = method === 'credit' || rnd() < 0.45 ? pick(PEOPLE) : undefined;
          // Sometimes a discount over the employee's limit, approved by the owner on the spot.
          let discounted = false;
          if (!asSet && rnd() < 0.08) {
            const l = cart[0];
            cart = setUnitPrice(cart, l.key, Math.floor((l.unitPrice * 0.8) / 1_000) * 1_000);
            discounted = true;
          }
          // Sometimes she pays part with her points (cash or card).
          let points = 0;
          const known = person ? customerByPhone(ctx, person.phone) : undefined;
          if (known && (method === 'cash' || method === 'card') && rnd() < 0.5) {
            const total = cart.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
            points = redeemable(ctx, known.id, total)?.points ?? 0;
            if (points) usedPoints++;
          }
          const res = checkout(ctx, {
            cart,
            paymentMethod: method,
            customer: person,
            points,
            ...(discounted ? { discountReason: 'زبونة دائمة', approval: 'ok' } : {}),
          });
          sales++;
          if (asSet) setSales++;
          receiptMatches(key, res.saleId, res.receipt.id);
          const sale = getSale(ctx, res.saleId)!;
          for (const c of cart) stock.set(c.productId, stock.get(c.productId)! - c.quantity);
          if (method === 'cash') drawer += sale.total - sale.pointsPaid;
          const cid = sale.customerId ?? null;
          if (cid && person) personOf.set(cid, person);
          if (method === 'credit' && cid) owed.set(cid, (owed.get(cid) ?? 0) + sale.total);
          saleMonth.set(res.saleId, {
            month: key.slice(0, 7),
            total: sale.total,
            cost: sale.totalCost,
          });
          todaysSales.push({ saleId: res.saleId, method, customerId: cid });
          const sumLines = sale.lines.reduce((n, l) => n + l.lineTotal, 0);
          if (sumLines !== sale.total)
            fail(key, `sale ${res.saleId}: lines ${sumLines} ≠ total ${sale.total}`);
        } else if (roll < 0.7 && todaysSales.length) {
          // A return of one piece of a sale from today.
          const s = pick(todaysSales);
          const sale = getSale(ctx, s.saleId);
          if (!sale) continue;
          const line = sale.lines.find((l) => l.quantity - l.returned > 0);
          if (!line) continue;
          // Paid back any way the sale allows (J2): only cash leaves the drawer.
          const how = pick(refundChoices({ paymentMethod: s.method, customerId: s.customerId }));
          const rid = addReturn(ctx, {
            saleLineId: line.id,
            quantity: 1,
            reason: 'لم يناسبها',
            refundMethod: how,
            ...passing(ctx),
          });
          if (how !== s.method) otherWay++;
          returns++;
          const refund = t.db.get<{ refund: number }>('SELECT refund FROM returns WHERE id = ?', [
            rid,
          ])!.refund;
          refunded(key, refund);
          stock.set(line.productId!, stock.get(line.productId!)! + 1);
          drawer -= paidBack(s.customerId, how, refund);
        } else if (roll < 0.78) {
          // A debt payment, in cash, from someone who owes.
          const debtors = [...owed.entries()].filter(([, v]) => v > 0);
          if (!debtors.length) continue;
          const [cid, v] = pick(debtors);
          const amount = Math.max(1_000, Math.floor((v * (0.2 + rnd() * 0.8)) / 1_000) * 1_000);
          const pay = Math.min(amount, v);
          recordPayment(ctx, { customerId: cid, amount: pay, method: 'cash' });
          owed.set(cid, v - pay);
          drawer += pay;
        } else if (roll < 0.84) {
          // A deposit: hold a piece in stock, or order one from the supplier.
          const person = pick(PEOPLE);
          if (rnd() < 0.5) {
            const id = pick(productIds);
            const p = getProduct(ctx, id)!;
            if (p.stock - (reservedCounts(ctx).get(id) ?? 0) < 1) continue;
            const amount = Math.ceil(p.price / 2 / 1_000) * 1_000;
            const r = takeOrder(ctx, {
              kind: 'hold',
              customer: person,
              productId: id,
              deposit: { amount, method: 'cash' },
            });
            const cid = customerByPhone(ctx, person.phone)!.id;
            personOf.set(cid, person);
            openOrders.push({ orderId: r.orderId, customerId: cid, productId: id, paid: amount });
            drawer += amount;
          } else {
            const unit = 200_000 + Math.floor(rnd() * 20) * 50_000;
            const r = takeOrder(ctx, {
              kind: 'order',
              customer: person,
              description: 'قطعة من المورد',
              unitPrice: unit,
              deposit: { amount: unit / 2, method: 'cash' },
            });
            const cid = customerByPhone(ctx, person.phone)!.id;
            personOf.set(cid, person);
            openOrders.push({
              orderId: r.orderId,
              customerId: cid,
              productId: null,
              paid: unit / 2,
            });
            drawer += unit / 2;
          }
          deposits++;
        } else if (roll < 0.9 && openOrders.length) {
          // Move an order along (owner), deliver it (employee), or cancel it.
          const o = pick(openOrders);
          const order = getOrder(ctx, o.orderId)!;
          if (order.kind === 'order' && order.status === 'waiting') {
            t.setActor(OWNER);
            markPurchased(ctx, o.orderId, {
              cost: Math.floor(order.price / 3),
              eta: dk(new Date(t.now().getTime() + 7 * 86_400_000)),
            });
            if (rnd() < 0.15) {
              // Cancelled after "bought": the shop keeps the deposit.
              cancelOrder(ctx, o.orderId, { how: 'keep', reason: 'ألغت' });
              openOrders.splice(openOrders.indexOf(o), 1);
              cancels++;
            }
            t.setActor(EMPLOYEE);
          } else if (order.kind === 'order' && order.status === 'purchased') {
            const pid = markArrived(ctx, o.orderId);
            o.productId = pid;
            stock.set(pid, getProduct(ctx, pid)!.stock);
            productIds.push(pid);
          } else if (rnd() < 0.2 && order.kind === 'hold') {
            const how = rnd() < 0.5 ? 'balance' : 'refund';
            cancelOrder(ctx, o.orderId, { how, approval: 'ok', reason: 'غيرت رأيها' });
            if (how === 'refund') drawer -= o.paid;
            else owed.set(o.customerId, (owed.get(o.customerId) ?? 0) - o.paid);
            openOrders.splice(openOrders.indexOf(o), 1);
            cancels++;
          } else {
            const cart = orderCart(ctx, order);
            if (!cart) continue;
            const c = personOf.get(o.customerId)!;
            const method = pick<PaymentMethod>(['cash', 'cash', 'card', 'credit']);
            const res = checkout(ctx, {
              cart,
              paymentMethod: method,
              customer: c,
              orderId: o.orderId,
            });
            const sale = getSale(ctx, res.saleId)!;
            for (const l of cart) stock.set(l.productId, stock.get(l.productId)! - l.quantity);
            const rest = sale.total - sale.pointsPaid - o.paid;
            if (method === 'cash') drawer += rest;
            if (method === 'credit')
              owed.set(o.customerId, (owed.get(o.customerId) ?? 0) + sale.total - o.paid);
            saleMonth.set(res.saleId, {
              month: key.slice(0, 7),
              total: sale.total,
              cost: sale.totalCost,
            });
            openOrders.splice(openOrders.indexOf(o), 1);
            deliveries++;
            sales++;
          }
        } else if (roll < 0.905 && todaysSales.length) {
          // An exchange: one piece back, another piece out, in one step.
          const s = pick(todaysSales);
          const sale = getSale(ctx, s.saleId);
          const line = sale?.lines.find((l) => l.quantity - l.returned > 0);
          const id = pick(productIds);
          const p = getProduct(ctx, id);
          if (!sale || !line || !p || p.stock - (reservedCounts(ctx).get(id) ?? 0) < 1) continue;
          const r = addToCart([], p, displayName(ctx, p), 1);
          if (!('cart' in r)) continue;
          const person = s.customerId ? personOf.get(s.customerId) : undefined;
          const method: PaymentMethod = s.method === 'credit' ? 'credit' : 'cash';
          const how = pick(refundChoices({ paymentMethod: s.method, customerId: s.customerId }));
          const res = exchange(ctx, {
            ret: {
              saleLineId: line.id,
              quantity: 1,
              reason: 'استبدال',
              refundMethod: how,
              ...passing(ctx),
            },
            sale: { cart: r.cart, paymentMethod: method, customer: person },
          });
          exchanges++;
          const refund = t.db.get<{ refund: number }>('SELECT refund FROM returns WHERE id = ?', [
            res.returnId,
          ])!.refund;
          refunded(key, refund);
          stock.set(line.productId!, stock.get(line.productId!)! + 1);
          stock.set(id, stock.get(id)! - 1);
          const newSale = getSale(ctx, res.saleId)!;
          drawer -= paidBack(s.customerId, how, refund);
          if (method === 'credit' && s.customerId)
            owed.set(s.customerId, (owed.get(s.customerId) ?? 0) + newSale.total);
          else drawer += newSale.total - newSale.pointsPaid;
          saleMonth.set(res.saleId, {
            month: key.slice(0, 7),
            total: newSale.total,
            cost: newSale.totalCost,
          });
          todaysSales.push({ saleId: res.saleId, method, customerId: newSale.customerId ?? null });
          sales++;
        } else if (roll < 0.91) {
          // The owner pays back a customer the shop owes, by transfer.
          const owedTo = [...owed.entries()].filter(([, v]) => v < 0);
          if (!owedTo.length) continue;
          const [cid, v] = pick(owedTo);
          t.setActor(OWNER);
          try {
            recordPayout(ctx, { customerId: cid, amount: -v, method: 'transfer' });
          } finally {
            t.setActor(EMPLOYEE);
          }
          owed.set(cid, 0);
          payouts++;
        } else if (roll < 0.93 && todaysSales.length) {
          // The owner deletes a sale from today (a mistake), when the rules allow.
          const s = todaysSales[todaysSales.length - 1];
          const sale = getSale(ctx, s.saleId);
          if (!sale || sale.lines.some((l) => l.returned > 0) || sale.depositUsed > 0) continue;
          t.setActor(OWNER);
          try {
            deleteSale(ctx, s.saleId, { deleteReceipt: true });
          } finally {
            t.setActor(EMPLOYEE);
          }
          for (const l of sale.lines)
            stock.set(l.productId!, stock.get(l.productId!)! + l.quantity);
          if (s.method === 'cash') drawer -= sale.total - sale.pointsPaid;
          if (s.method === 'credit' && s.customerId)
            owed.set(s.customerId, (owed.get(s.customerId) ?? 0) - sale.total);
          saleMonth.delete(s.saleId);
          todaysSales.splice(todaysSales.indexOf(s), 1);
          deletes++;
        }
      } catch (e) {
        if (!(e instanceof RuleError)) throw e;
        unexpected(
          e,
          roll < 0.62
            ? 'sale'
            : roll < 0.7
              ? 'return'
              : roll < 0.78
                ? 'payment'
                : roll < 0.84
                  ? 'deposit'
                  : roll < 0.9
                    ? 'order step'
                    : 'delete',
        );
      }
    }

    // Close the shift: the app's expected cash against ours.
    t.setNow(new Date(date.getTime() + 11 * 3_600_000));
    const shift = getShift(ctx, shiftId)!;
    const totals = shiftTotals(ctx, shift);
    if (totals.expected !== drawer)
      fail(key, `shift expected ${totals.expected}, our drawer ${drawer}`);
    const closed = closeShift(ctx, drawer);
    if (closed.difference !== 0) fail(key, `close difference ${closed.difference}`);

    // The owner looks at the day and the books.
    t.setActor(OWNER);
    if (day % 30 === 29) addExpense(ctx, { description: 'إيجار', amount: 1_500_000 });
    const ds = daySummary(ctx, key);
    const dsCash =
      ds.byMethod.cash +
      ds.payments.cash +
      ds.deposits.taken.cash -
      ds.deposits.refunded.cash +
      ds.cashIn -
      ds.cashOut -
      ds.cashRefunds -
      ds.payouts.cash;
    if (dsCash !== drawer - opening)
      fail(key, `day summary cash ${dsCash} ≠ the drawer's change ${drawer - opening}`);

    if (day % Number(process.env.CHECK_EVERY ?? 1) !== 0 && day !== DAYS - 1) continue;
    // Stock: the app, its moves and our record agree; nothing held beyond the stock.
    const held = reservedCounts(ctx);
    for (const r of t.db.all<{ id: number; stock: number; moves: number }>(
      'SELECT p.id, p.stock, (SELECT coalesce(sum(delta),0) FROM stock_moves m WHERE m.product_id = p.id) moves FROM products p',
    )) {
      if (r.stock !== r.moves) fail(key, `product ${r.id}: stock ${r.stock} ≠ moves ${r.moves}`);
      if (stock.has(r.id) && stock.get(r.id) !== r.stock)
        fail(key, `product ${r.id}: stock ${r.stock}, our record ${stock.get(r.id)}`);
      if ((held.get(r.id) ?? 0) > r.stock)
        fail(key, `product ${r.id}: held ${held.get(r.id)} > stock ${r.stock}`);
    }
    // Debts: each customer's balance against ours; points never below zero.
    for (const [cid, v] of owed)
      if (balance(ctx, cid) !== v)
        fail(key, `customer ${cid}: balance ${balance(ctx, cid)}, ours ${v}`);
    for (const r of t.db.all<{ id: number }>('SELECT id FROM customers'))
      if (pointsBalance(ctx, r.id) < 0)
        fail(key, `customer ${r.id}: points ${pointsBalance(ctx, r.id)}`);
  }

  // The month reports against our record of sales.
  const months = [...new Set([...saleMonth.values()].map((s) => s.month))];
  for (const m of months) {
    const ours = [...saleMonth.values()].filter((s) => s.month === m);
    const s = summary(ctx, [m]);
    const total = ours.reduce((n, x) => n + x.total, 0);
    if (s.grossSales !== total) fail(m, `month sales ${s.grossSales}, ours ${total}`);
  }
  // Receipt numbers never repeat; the activity log's chain holds; the database is sound.
  const dup = t.db.get<{ n: number }>(
    'SELECT count(*) n FROM (SELECT receipt_no FROM receipts GROUP BY receipt_no HAVING count(*) > 1)',
  )!.n;
  if (dup) fail('end', `${dup} receipt numbers used twice`);
  const log = verifyLog(ctx);
  if (!log.ok) fail('end', `activity log: ${JSON.stringify(log).slice(0, 200)}`);
  const integrity = t.db.get<{ integrity_check: string }>(
    'PRAGMA integrity_check',
  )!.integrity_check;
  if (integrity !== 'ok') fail('end', `integrity ${integrity}`);
  const fk = t.db.all('PRAGMA foreign_key_check');
  if (fk.length) fail('end', `foreign keys: ${JSON.stringify(fk.slice(0, 3))}`);
  // Close the first quarter and compare with the sales of those months.
  const q1 = closeQuarter(ctx, { year: 2026, quarter: 1 });
  const q1Sales = [...saleMonth.values()]
    .filter((s) => s.month <= '2026-03')
    .reduce((n, x) => n + x.total, 0);
  const q1Refunds = [...refundMonth.entries()]
    .filter(([m]) => m <= '2026-03')
    .reduce((n, [, x]) => n + x, 0);
  if (q1.totalSales !== q1Sales) fail('Q1', `closing sales ${q1.totalSales}, ours ${q1Sales}`);
  if (q1.totalRefunds !== q1Refunds)
    fail('Q1', `closing refunds ${q1.totalRefunds}, ours ${q1Refunds}`);

  // The run did real work: a quiet run checks nothing.
  const counts = {
    sales,
    setSales,
    otherWay,
    deliveries,
    exchanges,
    usedPoints,
    returns,
    deposits,
    cancels,
    deletes,
    payouts,
    restocks,
  };
  if (DAYS >= 120)
    for (const [what, n] of Object.entries(counts)) if (n === 0) fail('end', `no ${what} happened`);
  if (problems.length)
    console.log(
      [
        `seed ${process.env.SEED ?? 'default'}, ${DAYS} days: ${JSON.stringify(counts)}`,
        `refused by the rules (count): ${JSON.stringify([...errors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15))}`,
      ].join('\n'),
    );
  expect(problems).toEqual([]);
}, 600_000);
