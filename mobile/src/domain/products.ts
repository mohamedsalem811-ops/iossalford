import { latinDigits } from '@/lib/digits';
import { usdToLyd } from '@/lib/money';

import { ensureBrand } from './brands';
import { allow, clean, nowStamp, RuleError, type Ctx } from './context';
import { getRate } from './settings';

export type Product = {
  id: number;
  sku: string;
  name: string;
  brandId: number | null;
  brand: string | null;
  category: string;
  designId: string | null;
  size: string | null;
  color: string | null;
  /** Cost in dirhams. */
  cost: number;
  /** Cost in US cents and the rate used, when the cost was entered in dollars. */
  costUsd: number | null;
  costRate: number | null;
  /** Sell price in dirhams. */
  price: number;
  stock: number;
  lowStock: number;
  imageFile: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProductRow = {
  id: number;
  sku: string;
  name: string;
  brand_id: number | null;
  brand: string | null;
  category: string;
  design_id: string | null;
  size: string | null;
  color: string | null;
  cost: number;
  cost_usd: number | null;
  cost_rate: number | null;
  price: number;
  stock: number;
  low_stock: number;
  image_file: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
};

const SELECT = `SELECT p.*, b.name AS brand FROM products p LEFT JOIN brands b ON b.id = p.brand_id`;

function toProduct(r: ProductRow): Product {
  return {
    id: r.id,
    sku: r.sku,
    name: r.name,
    brandId: r.brand_id,
    brand: r.brand,
    category: r.category,
    designId: r.design_id,
    size: r.size,
    color: r.color,
    cost: r.cost,
    costUsd: r.cost_usd,
    costRate: r.cost_rate,
    price: r.price,
    stock: r.stock,
    lowStock: r.low_stock,
    imageFile: r.image_file,
    archived: r.archived === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Categories offered in each system (same as the current app). */
export const CATEGORIES = {
  jewelry: ['خواتم', 'أساور', 'قلادات', 'أقراط', 'دبابيس', 'ساعات', 'أطقم', 'أخرى'],
  scarves: ['حرير', 'كشمير', 'صوف', 'قطن', 'فيسكوز', 'شيفون', 'ساتان', 'أخرى'],
} as const;

const SKU_PREFIX: Record<string, string> = {
  خواتم: 'RNG',
  أساور: 'BRC',
  قلادات: 'NCK',
  أقراط: 'EAR',
  دبابيس: 'PIN',
  ساعات: 'WCH',
  أطقم: 'SET',
};

export const STANDARD_SCARF_SIZES = ['90×90', '120×120', '140×140'];

export const isLowStock = (p: Pick<Product, 'stock' | 'lowStock'>) =>
  p.stock > 0 && p.stock <= p.lowStock;
export const isOutOfStock = (p: Pick<Product, 'stock'>) => p.stock <= 0;

/** Name on sales and receipts: scarves add the size ("وشاح حرير — 120×120"). */
export function displayName(ctx: Pick<Ctx, 'system'>, p: Pick<Product, 'name' | 'size'>): string {
  return ctx.system === 'scarves' && p.size ? `${p.name} — ${p.size}` : p.name;
}

export function getProduct(ctx: Ctx, id: number): Product | undefined {
  const r = ctx.db.get<ProductRow>(`${SELECT} WHERE p.id = ?`, [id]);
  return r ? toProduct(r) : undefined;
}

function requireProduct(ctx: Ctx, id: number): Product {
  const p = getProduct(ctx, id);
  if (!p) throw new RuleError('القطعة غير موجودة في المخزون');
  return p;
}

/** The product using this code (any case), if any. */
export function productBySku(ctx: Ctx, sku: string): Product | undefined {
  const r = ctx.db.get<ProductRow>(`${SELECT} WHERE p.sku = ? COLLATE NOCASE`, [sku.trim()]);
  return r ? toProduct(r) : undefined;
}

/** Next free code: SCF-0001… for scarves, RNG-0007 etc. by category for jewelry. Never repeats. */
export function generateSku(ctx: Ctx, category: string): string {
  const prefix = ctx.system === 'scarves' ? 'SCF' : (SKU_PREFIX[category] ?? 'PRD');
  const rows = ctx.db.all<{ sku: string }>('SELECT sku FROM products WHERE sku LIKE ?', [
    `${prefix}-%`,
  ]);
  let n = rows.reduce((max, r) => {
    const m = /^[A-Z]+-(\d+)$/i.exec(r.sku);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  let sku: string;
  do {
    n += 1;
    sku = `${prefix}-${String(n).padStart(4, '0')}`;
  } while (productBySku(ctx, sku));
  return sku;
}

export type ProductInput = {
  id?: number;
  /** Empty: a code is generated. */
  sku?: string;
  name: string;
  brand?: string | null;
  category: string;
  size?: string | null;
  color?: string | null;
  /** Cost in dirhams, or in US cents (converted at the current rate). */
  cost?: number;
  costUsd?: number | null;
  price: number;
  /** New products: opening stock. Edits: the counted stock; a difference is recorded as an adjustment. */
  stock: number;
  lowStock?: number;
  imageFile?: string | null;
  designId?: string | null;
};

function validate(input: ProductInput) {
  if (!clean(input.name)) throw new RuleError('يرجى إدخال اسم القطعة');
  if (!Number.isInteger(input.price) || input.price < 0) throw new RuleError('سعر البيع غير صحيح');
  if (!Number.isInteger(input.stock) || input.stock < 0) throw new RuleError('الكمية غير صحيحة');
  if (input.cost !== undefined && (!Number.isInteger(input.cost) || input.cost < 0))
    throw new RuleError('التكلفة غير صحيحة');
}

function recordMove(
  ctx: Ctx,
  productId: number,
  delta: number,
  kind: string,
  reason: string | null,
  refId: number | null = null,
) {
  if (delta === 0) return;
  ctx.db.run(
    'INSERT INTO stock_moves (product_id, delta, kind, reason, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [productId, delta, kind, reason, refId, nowStamp(ctx)],
  );
}

/** Creates or updates a product. Returns its id. Refuses a code already used by another piece. */
export function saveProduct(ctx: Ctx, input: ProductInput): number {
  allow(ctx, 'products.edit');
  validate(input);
  return ctx.db.transaction(() => {
    const typed = (input.sku ?? '').trim().toUpperCase();
    if (typed) {
      const other = productBySku(ctx, typed);
      if (other && other.id !== input.id) {
        throw new RuleError(
          `الكود ${typed} مستخدم للقطعة «${other.name}». اختر كوداً آخر أو اتركه فارغاً ليُولّد تلقائياً.`,
        );
      }
    }
    const brandId = ensureBrand(ctx, input.brand);
    const rate = getRate(ctx);
    const usd = input.costUsd ?? null;
    const cost = usd !== null ? usdToLyd(usd, rate) : (input.cost ?? 0);
    const stamp = nowStamp(ctx);
    const size = input.size ? latinDigits(input.size.trim()) : null;

    if (input.id) {
      const old = requireProduct(ctx, input.id);
      const sku = typed || old.sku;
      // The same dollar cost as before keeps the rate it was bought at: editing the name or the
      // price must not reprice the cost at today's rate.
      const sameUsd = usd !== null && usd === old.costUsd && old.costRate !== null;
      const finalCost = sameUsd ? old.cost : cost;
      const costChanged = !sameUsd && (cost !== old.cost || usd !== old.costUsd);
      ctx.db.run(
        `UPDATE products SET sku = ?, name = ?, brand_id = ?, category = ?, size = ?, color = ?, cost = ?,
           cost_usd = ?, cost_rate = ?, price = ?, stock = ?, low_stock = ?, image_file = ?, design_id = ?, updated_at = ?
         WHERE id = ?`,
        [
          sku,
          input.name.trim(),
          brandId,
          input.category,
          size,
          clean(input.color),
          finalCost,
          usd,
          costChanged ? (usd !== null ? rate : null) : old.costRate,
          input.price,
          input.stock,
          input.lowStock ?? old.lowStock,
          input.imageFile === undefined ? old.imageFile : input.imageFile,
          input.designId === undefined ? old.designId : input.designId,
          stamp,
          input.id,
        ],
      );
      recordMove(ctx, input.id, input.stock - old.stock, 'adjust', 'تعديل من نموذج القطعة');
      return input.id;
    }

    const id = ctx.db.run(
      `INSERT INTO products (sku, name, brand_id, category, size, color, cost, cost_usd, cost_rate, price, stock,
         low_stock, image_file, design_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        typed || generateSku(ctx, input.category),
        input.name.trim(),
        brandId,
        input.category,
        size,
        clean(input.color),
        cost,
        usd,
        usd !== null ? rate : null,
        input.price,
        input.stock,
        input.lowStock ?? 2,
        input.imageFile ?? null,
        input.designId ?? null,
        stamp,
        stamp,
      ],
    ).lastInsertRowId;
    recordMove(ctx, id, input.stock, 'initial', null);
    return id;
  });
}

/** Changes stock by `delta` (a delivery +3, breakage −1) with a reason. Stock never goes below 0. */
export function adjustStock(ctx: Ctx, productId: number, delta: number, reason: string) {
  allow(ctx, 'stock.adjust');
  if (!Number.isInteger(delta) || delta === 0)
    throw new RuleError('أدخل الكمية المضافة أو المنقوصة');
  if (!clean(reason)) throw new RuleError('اكتب سبب تعديل المخزون');
  ctx.db.transaction(() => {
    const p = requireProduct(ctx, productId);
    if (p.stock + delta < 0) throw new RuleError(`المتوفر ${p.stock} فقط، لا يمكن إنقاص ${-delta}`);
    ctx.db.run('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?', [
      delta,
      nowStamp(ctx),
      productId,
    ]);
    recordMove(ctx, productId, delta, 'adjust', clean(reason));
  });
}

/** Internal: stock change caused by a sale, return or deletion (used by later modules). */
export function moveStock(
  ctx: Ctx,
  productId: number,
  delta: number,
  kind: 'sale' | 'return' | 'sale_deleted' | 'return_deleted',
  refId: number,
) {
  const r = ctx.db.run(
    'UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ? AND stock + ? >= 0',
    [delta, nowStamp(ctx), productId, delta],
  );
  if (r.changes === 1) recordMove(ctx, productId, delta, kind, null, refId);
  return r.changes === 1;
}

export type StockMove = {
  id: number;
  delta: number;
  kind: string;
  reason: string | null;
  createdAt: string;
};

export function stockHistory(ctx: Ctx, productId: number): StockMove[] {
  return ctx.db
    .all<{ id: number; delta: number; kind: string; reason: string | null; created_at: string }>(
      'SELECT id, delta, kind, reason, created_at FROM stock_moves WHERE product_id = ? ORDER BY id DESC',
      [productId],
    )
    .map((m) => ({
      id: m.id,
      delta: m.delta,
      kind: m.kind,
      reason: m.reason,
      createdAt: m.created_at,
    }));
}

/** Has this product ever been sold or returned? Then it is archived, not deleted. */
function hasHistory(ctx: Ctx, id: number): boolean {
  return !!ctx.db.get(
    'SELECT 1 FROM sale_lines WHERE product_id = ? UNION ALL SELECT 1 FROM returns WHERE product_id = ? LIMIT 1',
    [id, id],
  );
}

/** How many sales (checkouts) included this product, and how many sets contain it. */
export function productUsage(ctx: Ctx, id: number): { sales: number; sets: number } {
  const r = ctx.db.get<{ sales: number; sets: number }>(
    `SELECT (SELECT count(DISTINCT sale_id) FROM sale_lines WHERE product_id = ?) AS sales,
            (SELECT count(*) FROM set_items WHERE product_id = ?) AS sets`,
    [id, id],
  );
  return { sales: r?.sales ?? 0, sets: r?.sets ?? 0 };
}

/**
 * Removes a product. One that was ever sold is archived instead: it disappears from the shop's
 * lists and sets, while sales, receipts and reports keep showing it correctly.
 */
export function deleteProduct(ctx: Ctx, id: number): 'deleted' | 'archived' {
  allow(ctx, 'products.edit');
  return ctx.db.transaction(() => {
    requireProduct(ctx, id);
    if (hasHistory(ctx, id)) {
      ctx.db.run('UPDATE products SET archived = 1, updated_at = ? WHERE id = ?', [
        nowStamp(ctx),
        id,
      ]);
      ctx.db.run('DELETE FROM set_items WHERE product_id = ?', [id]);
      return 'archived';
    }
    ctx.db.run('DELETE FROM products WHERE id = ?', [id]);
    return 'deleted';
  });
}

export function restoreProduct(ctx: Ctx, id: number) {
  allow(ctx, 'products.edit');
  ctx.db.run('UPDATE products SET archived = 0, updated_at = ? WHERE id = ?', [nowStamp(ctx), id]);
}

export type ProductQuery = {
  search?: string;
  brandId?: number | null;
  category?: string;
  size?: string;
  stock?: 'all' | 'low' | 'out' | 'available';
  sort?: 'newest' | 'name' | 'price_high' | 'price_low' | 'stock_low';
  archived?: boolean;
};

/** Products for the lists: search by name, code or brand; filters; sorting. */
export function listProducts(ctx: Ctx, q: ProductQuery = {}): Product[] {
  const where: string[] = ['p.archived = ?'];
  const params: (string | number)[] = [q.archived ? 1 : 0];
  const search = clean(latinDigits(q.search ?? ''));
  if (search) {
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR b.name LIKE ? OR p.color LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (q.brandId !== undefined) {
    if (q.brandId === null) where.push('p.brand_id IS NULL');
    else {
      where.push('p.brand_id = ?');
      params.push(q.brandId);
    }
  }
  if (q.category) {
    where.push('p.category = ?');
    params.push(q.category);
  }
  if (q.size) {
    where.push('p.size = ?');
    params.push(q.size);
  }
  if (q.stock === 'low') where.push('p.stock > 0 AND p.stock <= p.low_stock');
  if (q.stock === 'out') where.push('p.stock = 0');
  if (q.stock === 'available') where.push('p.stock > 0');
  const order = {
    newest: 'p.id DESC',
    name: 'p.name COLLATE NOCASE, p.id',
    price_high: 'p.price DESC, p.id',
    price_low: 'p.price ASC, p.id',
    stock_low: 'p.stock ASC, p.id',
  }[q.sort ?? 'newest'];
  return ctx.db
    .all<ProductRow>(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order}`, params)
    .map(toProduct);
}
