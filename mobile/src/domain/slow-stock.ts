/**
 * Slow-moving stock (J5), the owner's: pieces in stock with no sale for 60, 90 or 180 days (or
 * never sold since they came in), how long, and the money tied up in them (cost × stock), by
 * brand, the most money first.
 *
 * A piece is idle since its last sale, or since stock last came in (it was added, or stock was
 * raised by hand: a new delivery), whichever is later. Archived pieces are left out, and so is
 * what is held for customers with a deposit or bought for their order: it is sold, not slow.
 */
import { logAction } from './activity';
import { allow, allowView, nowStamp, RuleError, type Ctx } from './context';
import { getProduct } from './products';
import { refuseIfOrdered, reservedCounts } from './reserved';

export const SLOW_DAYS = [60, 90, 180] as const;
export type SlowDays = (typeof SLOW_DAYS)[number];

export type SlowRow = {
  productId: number;
  sku: string;
  name: string;
  size: string | null;
  brand: string | null;
  category: string;
  imageFile: string | null;
  /** In stock, less what is held for customers. */
  stock: number;
  cost: number;
  price: number;
  /** cost × stock. */
  tiedUp: number;
  /** The last sale, or null when never sold. */
  lastSold: string | null;
  /** When it went idle: the last sale or the last stock to come in. */
  since: string;
  /** Whole days since then. */
  days: number;
};

export type SlowBrand = { brand: string; items: number; pieces: number; tiedUp: number };

const NO_BRAND = 'بدون ماركة';
const DAY = 86_400_000;

export function slowStock(
  ctx: Ctx,
  minDays: number,
): { rows: SlowRow[]; brands: SlowBrand[]; total: Omit<SlowBrand, 'brand'> } {
  allowView(ctx, 'costs.view');
  const now = ctx.now().getTime();
  const held = reservedCounts(ctx);
  const rows = ctx.db
    .all<{
      id: number;
      sku: string;
      name: string;
      size: string | null;
      brand: string | null;
      category: string;
      image_file: string | null;
      stock: number;
      cost: number;
      price: number;
      created_at: string;
      sold: string | null;
      came: string | null;
    }>(
      `SELECT p.id, p.sku, p.name, p.size, b.name brand, p.category, p.image_file, p.stock, p.cost,
              p.price, p.created_at,
              (SELECT max(s.created_at) FROM sale_lines l JOIN sales s ON s.id = l.sale_id
                WHERE l.product_id = p.id) sold,
              (SELECT max(m.created_at) FROM stock_moves m
                WHERE m.product_id = p.id AND m.delta > 0 AND m.kind IN ('initial', 'adjust')) came
         FROM products p LEFT JOIN brands b ON b.id = p.brand_id
        WHERE p.archived = 0 AND p.stock > 0`,
    )
    .map((r) => ({ ...r, stock: r.stock - (held.get(r.id) ?? 0) }))
    .filter((r) => r.stock > 0)
    .map((r): SlowRow => {
      const since = [r.created_at, r.sold, r.came]
        .filter((t): t is string => !!t)
        .reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
      return {
        productId: r.id,
        sku: r.sku,
        name: r.name,
        size: r.size,
        brand: r.brand,
        category: r.category,
        imageFile: r.image_file,
        stock: r.stock,
        cost: r.cost,
        price: r.price,
        tiedUp: r.cost * r.stock,
        lastSold: r.sold,
        since,
        days: Math.floor((now - Date.parse(since)) / DAY),
      };
    })
    .filter((r) => r.days >= minDays)
    .sort((a, b) => b.tiedUp - a.tiedUp || b.days - a.days || a.productId - b.productId);

  const byBrand = new Map<string, SlowBrand>();
  for (const r of rows) {
    const brand = r.brand ?? NO_BRAND;
    const b = byBrand.get(brand) ?? { brand, items: 0, pieces: 0, tiedUp: 0 };
    b.items += 1;
    b.pieces += r.stock;
    b.tiedUp += r.tiedUp;
    byBrand.set(brand, b);
  }
  const brands = [...byBrand.values()].sort((a, b) => b.tiedUp - a.tiedUp);
  const total = brands.reduce(
    (t, b) => ({
      items: t.items + b.items,
      pieces: t.pieces + b.pieces,
      tiedUp: t.tiedUp + b.tiedUp,
    }),
    { items: 0, pieces: 0, tiedUp: 0 },
  );
  return { rows, brands, total };
}

/** Changes only a piece's sell price (a markdown for slow stock), logged with the old and new. */
export function setProductPrice(ctx: Ctx, productId: number, price: number) {
  allow(ctx, 'products.edit');
  if (!Number.isInteger(price) || price <= 0) throw new RuleError('اكتب سعر بيع صحيح أكبر من صفر');
  ctx.db.transaction(() => {
    const p = getProduct(ctx, productId);
    if (!p) throw new RuleError('القطعة غير موجودة في المخزون');
    refuseIfOrdered(ctx, productId);
    if (p.price === price) return;
    ctx.db.run('UPDATE products SET price = ?, updated_at = ? WHERE id = ?', [
      price,
      nowStamp(ctx),
      productId,
    ]);
    logAction(ctx, 'product.price', `تغيير سعر «${p.size ? `${p.name} (${p.size})` : p.name}»`, {
      productId,
      from: p.price,
      to: price,
    });
  });
}
