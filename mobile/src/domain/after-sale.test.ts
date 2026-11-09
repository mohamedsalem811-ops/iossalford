/**
 * @jest-environment node
 */
import { addSet, addToCart, type CartLine } from './cart';
import { checkout, type PaymentMethod } from './checkout';
import { saveCustomer } from './customers';
import {
  balance,
  creditBalances,
  debtors,
  deleteCustomer,
  deletePayment,
  payments,
  recordPayment,
  totalOutstanding,
} from './debts';
import {
  addExpense,
  deleteExpense,
  expensesByMonth,
  isMonthClosed,
  listExpenses,
} from './expenses';
import { getProduct, saveProduct, stockHistory, type Product } from './products';
import { receiptForSale } from './receipts';
import {
  addReturn,
  addReturnWithoutSale,
  deleteReturn,
  deleteSale,
  getSale,
  listReturns,
  listSales,
  maxRefund,
} from './sales';
import { getSet, saveSet, setForCart } from './sets';
import { makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
beforeEach(() => {
  ctx = makeCtx('jewelry');
});
afterEach(() => ctx.close());

function product(name: string, price: number, stock: number, cost = 100_000): Product {
  return getProduct(ctx, saveProduct(ctx, { name, category: 'خواتم', price, cost, stock }))!;
}

function sell(
  p: Product,
  qty: number,
  method: PaymentMethod = 'cash',
  customer?: { name?: string; phone?: string },
  price?: number,
) {
  const r = addToCart([], p, p.name, qty, price);
  if ('problem' in r) throw new Error('cart');
  return checkout(ctx, { cart: r.cart, paymentMethod: method, customer });
}

describe('returns', () => {
  it('refunds what was paid by default, returns the pieces to stock and caps the quantity', () => {
    const ring = product('خاتم', 350_000, 3, 200_000);
    const { saleId } = sell(ring, 2, 'cash', undefined, 300_000);
    const line = getSale(ctx, saleId)!.lines[0];
    const id = addReturn(ctx, { saleLineId: line.id, quantity: 1, reason: 'مقاس' });
    const [r] = listReturns(ctx);
    expect(r).toMatchObject({ id, refund: 300_000, cost: 200_000, quantity: 1, month: '2026-11' });
    expect(getProduct(ctx, ring.id)?.stock).toBe(2);
    expect(stockHistory(ctx, ring.id)[0]).toMatchObject({ kind: 'return', delta: 1 });
    expect(() => addReturn(ctx, { saleLineId: line.id, quantity: 2 })).toThrow(
      'يمكن إرجاع 1 قطعة فقط',
    );
    addReturn(ctx, { saleLineId: line.id, quantity: 1 });
    expect(() => addReturn(ctx, { saleLineId: line.id, quantity: 1 })).toThrow('مُرتجعة بالفعل');
  });

  it('refuses a refund above what the customer paid', () => {
    const ring = product('خاتم', 350_000, 1);
    const line = getSale(ctx, sell(ring, 1).saleId)!.lines[0];
    expect(() => addReturn(ctx, { saleLineId: line.id, quantity: 1, refund: 350_001 })).toThrow(
      'لا يمكن أن يتجاوز',
    );
    expect(() => addReturn(ctx, { saleLineId: line.id, quantity: 0 })).toThrow('1 على الأقل');
  });

  it('caps refunds of a set piece at its share of the set price', () => {
    const a = product('قلادة', 600_000, 1);
    const b = product('حلق', 300_000, 1);
    const set = getSet(
      ctx,
      saveSet(ctx, {
        name: 'طقم',
        discount: 90_000,
        items: [
          { productId: a.id, quantity: 1 },
          { productId: b.id, quantity: 1 },
        ],
      }),
    )!;
    const cart = (addSet([], setForCart(ctx, set)) as { cart: CartLine[] }).cart;
    const sale = getSale(ctx, checkout(ctx, { cart, paymentMethod: 'cash' }).saleId)!;
    const neck = sale.lines.find((l) => l.productId === a.id)!;
    expect(maxRefund(neck, 1)).toBe(540_000);
  });

  it('records a return without a sale and undoes returns only while the pieces are in stock', () => {
    const ring = product('خاتم', 350_000, 0);
    const id = addReturnWithoutSale(ctx, { productId: ring.id, quantity: 1, refund: 300_000 });
    expect(listReturns(ctx)[0].reason).toBe('مرتجع بدون فاتورة');
    expect(getProduct(ctx, ring.id)?.stock).toBe(1);
    sell(getProduct(ctx, ring.id)!, 1); // the returned piece is sold again
    expect(() => deleteReturn(ctx, id)).toThrow('لم تعد في المخزون');
    expect(listReturns(ctx)).toHaveLength(1);
  });

  it('undoes a return, taking the pieces out of stock again', () => {
    const ring = product('خاتم', 350_000, 2);
    const line = getSale(ctx, sell(ring, 1).saleId)!.lines[0];
    const id = addReturn(ctx, { saleLineId: line.id, quantity: 1 });
    deleteReturn(ctx, id);
    expect(getProduct(ctx, ring.id)?.stock).toBe(1);
    expect(listReturns(ctx)).toHaveLength(0);
  });
});

describe('deleting a sale', () => {
  it('puts back only the pieces not already returned and removes its returns; the receipt stays', () => {
    const ring = product('خاتم', 350_000, 5);
    const { saleId } = sell(ring, 3);
    const line = getSale(ctx, saleId)!.lines[0];
    addReturn(ctx, { saleLineId: line.id, quantity: 1 });
    expect(getProduct(ctx, ring.id)?.stock).toBe(3);
    const receiptId = receiptForSale(ctx, saleId)!.id;
    deleteSale(ctx, saleId);
    expect(getProduct(ctx, ring.id)?.stock).toBe(5);
    expect(listReturns(ctx)).toHaveLength(0);
    expect(getSale(ctx, saleId)).toBeUndefined();
    expect(
      ctx.db.get<{ sale_id: number | null }>('SELECT sale_id FROM receipts WHERE id = ?', [
        receiptId,
      ])?.sale_id,
    ).toBeNull();
  });

  it('lists and filters sales', () => {
    const ring = product('خاتم ذهبي', 350_000, 5);
    sell(ring, 1, 'cash');
    sell(ring, 1, 'card', { name: 'سارة' });
    expect(listSales(ctx)).toHaveLength(2);
    expect(listSales(ctx, { paymentMethod: 'card' })).toHaveLength(1);
    expect(listSales(ctx, { search: 'سارة' })).toHaveLength(1);
    expect(listSales(ctx, { search: 'ذهبي' })).toHaveLength(2);
    expect(listSales(ctx, { month: '2026-10' })).toHaveLength(0);
  });
});

describe('debts', () => {
  it('owes credit sales minus credit refunds minus payments', () => {
    const ring = product('خاتم', 350_000, 5);
    const c = { name: 'سارة', phone: '0912345678' };
    const s1 = sell(ring, 2, 'credit', c);
    sell(ring, 1, 'cash', c); // cash sales are not debt
    const id = getSale(ctx, s1.saleId)!.customerId!;
    expect(balance(ctx, id)).toBe(700_000);
    addReturn(ctx, { saleLineId: getSale(ctx, s1.saleId)!.lines[0].id, quantity: 1 });
    expect(balance(ctx, id)).toBe(350_000);
    recordPayment(ctx, { customerId: id, amount: 100_000, method: 'cash' });
    expect(balance(ctx, id)).toBe(250_000);
    expect(debtors(ctx).map((d) => [d.customer.name, d.balance])).toEqual([['سارة', 250_000]]);
    expect(totalOutstanding(ctx)).toBe(250_000);
    expect(payments(ctx, id)).toHaveLength(1);
  });

  it('refuses a payment above what is owed', () => {
    const ring = product('خاتم', 350_000, 5);
    const id = getSale(ctx, sell(ring, 1, 'credit', { name: 'منى' }).saleId)!.customerId!;
    expect(() => recordPayment(ctx, { customerId: id, amount: 350_001, method: 'cash' })).toThrow(
      'أكبر من المستحق',
    );
    expect(() => recordPayment(ctx, { customerId: id, amount: 0, method: 'cash' })).toThrow(
      'مبلغ الدفعة',
    );
    const p = recordPayment(ctx, { customerId: id, amount: 350_000, method: 'transfer' });
    expect(balance(ctx, id)).toBe(0);
    deletePayment(ctx, p);
    expect(balance(ctx, id)).toBe(350_000);
  });

  it('shows "له رصيد" when a paid credit sale is later refunded', () => {
    const ring = product('خاتم', 350_000, 5);
    const s = sell(ring, 1, 'credit', { name: 'هدى' });
    const id = getSale(ctx, s.saleId)!.customerId!;
    recordPayment(ctx, { customerId: id, amount: 350_000, method: 'cash' });
    addReturn(ctx, { saleLineId: getSale(ctx, s.saleId)!.lines[0].id, quantity: 1 });
    expect(balance(ctx, id)).toBe(-350_000);
    expect(creditBalances(ctx).map((d) => d.customer.name)).toEqual(['هدى']);
  });

  it('protects customers with money owed either way or credit history', () => {
    const ring = product('خاتم', 350_000, 5);
    const owing = getSale(ctx, sell(ring, 1, 'credit', { name: 'منى' }).saleId)!.customerId!;
    expect(() => deleteCustomer(ctx, owing)).toThrow('عليه 350 د.ل');
    recordPayment(ctx, { customerId: owing, amount: 350_000, method: 'cash' });
    expect(() => deleteCustomer(ctx, owing)).toThrow('تعاملات آجلة');
    const cashOnly = saveCustomer(ctx, { name: 'زبون نقدي' });
    deleteCustomer(ctx, cashOnly);
    expect(ctx.db.get('SELECT 1 FROM customers WHERE id = ?', [cashOnly])).toBeUndefined();
  });
});

describe('expenses', () => {
  it('books to a chosen month, groups by month and warns for closed quarters', () => {
    addExpense(ctx, { description: 'إيجار', amount: 1_500_000 });
    addExpense(ctx, { description: 'كهرباء', amount: 200_000, month: '2026-09' });
    expect(listExpenses(ctx, '2026-11')).toHaveLength(1);
    expect(expensesByMonth(ctx).map((g) => [g.month, g.total])).toEqual([
      ['2026-11', 1_500_000],
      ['2026-09', 200_000],
    ]);
    expect(isMonthClosed(ctx, '2026-09')).toBe(false);
    ctx.db.run(
      `INSERT INTO closings (period_key, title, total_sales, total_cost, total_expenses, total_refunds, net_profit, transactions, items_sold, closed_at)
       VALUES ('2026-Q3', 'الربع الثالث 2026', 0, 0, 0, 0, 0, 0, 0, '2026-10-01T09:00:00')`,
    );
    expect(isMonthClosed(ctx, '2026-09')).toBe(true);
    expect(isMonthClosed(ctx, '2026-11')).toBe(false);
  });

  it('validates and deletes', () => {
    expect(() => addExpense(ctx, { description: '', amount: 1 })).toThrow('وصف');
    expect(() => addExpense(ctx, { description: 'x', amount: 0 })).toThrow('مبلغ');
    expect(() => addExpense(ctx, { description: 'x', amount: 1, month: '2026-13' })).toThrow(
      'الشهر',
    );
    const id = addExpense(ctx, { description: 'x', amount: 1 });
    deleteExpense(ctx, id);
    expect(listExpenses(ctx)).toHaveLength(0);
  });
});
