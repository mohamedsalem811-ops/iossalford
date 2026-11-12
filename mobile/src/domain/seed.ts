/**
 * Sample data for test builds, the gallery and simulator tests only. The real app starts empty:
 * nothing calls this outside development, and it refuses to run on a database that has products.
 */
import { addToCart, type CartLine } from './cart';
import { checkout } from './checkout';
import { RuleError, type Ctx } from './context';
import { saveCustomer } from './customers';
import { recordPayment } from './debts';
import { addExpense } from './expenses';
import { getProduct, saveProduct, displayName } from './products';
import { saveScarfDesign } from './scarves';
import { saveSet } from './sets';
import { setRate } from './settings';

function sell(
  ctx: Ctx,
  items: [number, number][],
  paymentMethod: 'cash' | 'card' | 'transfer' | 'credit',
  customer?: { name: string; phone?: string },
) {
  let cart: CartLine[] = [];
  for (const [id, qty] of items) {
    const p = getProduct(ctx, id)!;
    const r = addToCart(cart, p, displayName(ctx, p), qty);
    if ('problem' in r) throw new Error(`seed: ${p.name}`);
    cart = r.cart;
  }
  return checkout(ctx, { cart, paymentMethod, customer });
}

export function seedDemo(ctx: Ctx) {
  if (ctx.db.get('SELECT 1 FROM products LIMIT 1'))
    throw new RuleError('البيانات التجريبية تُضاف إلى قاعدة فارغة فقط');
  ctx.db.transaction(() => {
    setRate(ctx, 7_125);
    const sara = saveCustomer(ctx, { name: 'سارة أحمد', phone: '0912345678', area: 'طرابلس' });
    saveCustomer(ctx, { name: 'منى علي', phone: '0921234567', area: 'بنغازي' });

    if (ctx.system === 'jewelry') {
      const ring = saveProduct(ctx, {
        name: 'خاتم زركون',
        brand: 'Pandora',
        category: 'خواتم',
        color: 'فضي',
        price: 350_000,
        cost: 200_000,
        stock: 6,
      });
      const neck = saveProduct(ctx, {
        name: 'قلادة كريستال',
        brand: 'Swarovski',
        category: 'قلادات',
        price: 600_000,
        costUsd: 5_000,
        stock: 3,
      });
      const brace = saveProduct(ctx, {
        name: 'سوار تنس',
        brand: 'Swarovski',
        category: 'أساور',
        price: 420_000,
        cost: 250_000,
        stock: 1,
        lowStock: 2,
      });
      // Out of stock, to show the "نفد" state.
      saveProduct(ctx, {
        name: 'حلق لؤلؤ',
        category: 'أقراط',
        price: 200_000,
        cost: 90_000,
        stock: 0,
      });
      saveSet(ctx, {
        name: 'طقم السهرة',
        discount: 70_000,
        items: [
          { productId: neck, quantity: 1 },
          { productId: ring, quantity: 1 },
        ],
      });
      sell(ctx, [[ring, 2]], 'cash');
      sell(
        ctx,
        [
          [neck, 1],
          [brace, 1],
        ],
        'credit',
        { name: 'سارة أحمد', phone: '0912345678' },
      );
    } else {
      const silk = saveScarfDesign(ctx, {
        name: 'وشاح حرير زهري',
        brand: 'SALFORD',
        color: 'زهري',
        category: 'حرير',
        sizes: [
          { size: '90×90', price: 220_000, cost: 100_000, stock: 12 },
          { size: '120×120', price: 280_000, cost: 130_000, stock: 7 },
          { size: '140×140', price: 340_000, cost: 160_000, stock: 3 },
        ],
      });
      saveScarfDesign(ctx, {
        name: 'وشاح كشمير',
        category: 'كشمير',
        sizes: [{ size: '140×140', price: 450_000, cost: 220_000, stock: 2 }],
      });
      const first = ctx.db.get<{ id: number }>(
        'SELECT id FROM products WHERE design_id = ? ORDER BY id LIMIT 1',
        [silk],
      )!.id;
      sell(ctx, [[first, 2]], 'card');
      sell(ctx, [[first, 1]], 'credit', { name: 'سارة أحمد', phone: '0912345678' });
    }

    recordPayment(ctx, { customerId: sara, amount: 100_000, method: 'cash', note: 'دفعة أولى' });
    addExpense(ctx, { description: 'إيجار المحل', amount: 1_500_000 });
  });
}
