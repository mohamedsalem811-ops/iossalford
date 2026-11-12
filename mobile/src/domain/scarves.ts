/**
 * Scarf designs: one product per size, sharing a design id (name, brand, material, colour and
 * photo shared; each size with its own price, cost and stock).
 */
import { latinDigits } from '@/lib/digits';
import { clean, RuleError, type Ctx } from './context';

import { deleteProduct, saveProduct, type Product } from './products';

/** "90×90" before "120×120": by the first number; unknown sizes last. */
export function sizeSortKey(size: string | null | undefined): number {
  const m = /^\s*(\d+(?:\.\d+)?)/.exec(latinDigits(size ?? ''));
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

export type ScarfDesign = {
  id: string;
  sizes: Product[];
  name: string;
  brand: string | null;
  totalStock: number;
  minPrice: number;
  maxPrice: number;
};

/** Groups products by design; a product without a design id is a design of its own. */
export function groupDesigns(products: Product[]): ScarfDesign[] {
  const order: string[] = [];
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.designId ?? `single-${p.id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(p);
  }
  return order.map((id) => {
    const sizes = groups.get(id)!.sort((a, b) => sizeSortKey(a.size) - sizeSortKey(b.size));
    return {
      id,
      sizes,
      name: sizes[0].name,
      brand: sizes[0].brand,
      totalStock: sizes.reduce((s, p) => s + p.stock, 0),
      minPrice: Math.min(...sizes.map((p) => p.price)),
      maxPrice: Math.max(...sizes.map((p) => p.price)),
    };
  });
}

export type ScarfSizeInput = {
  productId?: number;
  size: string;
  price: number;
  cost: number;
  stock: number;
  lowStock?: number;
};

export type ScarfDesignInput = {
  designId?: string;
  name: string;
  brand?: string | null;
  color?: string | null;
  category: string;
  imageFile?: string | null;
  sizes: ScarfSizeInput[];
};

function newDesignId(ctx: Ctx): string {
  return `D${ctx.now().getTime().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Saves a whole design: shared details on every size, and each size's own price, cost and stock.
 * Sizes removed from the form are deleted (or archived if they were sold). Returns the design id.
 */
export function saveScarfDesign(ctx: Ctx, input: ScarfDesignInput): string {
  if (!clean(input.name)) throw new RuleError('يرجى إدخال اسم التصميم');
  const rows = input.sizes.filter((s) => clean(s.size));
  if (rows.length === 0) throw new RuleError('أضف مقاساً واحداً على الأقل');
  const keys = rows.map((r) => latinDigits(r.size.trim()).toLowerCase());
  if (new Set(keys).size !== keys.length) throw new RuleError('كل مقاس يجب أن يُضاف مرة واحدة فقط');
  for (const r of rows) {
    if (!Number.isInteger(r.price) || r.price <= 0)
      throw new RuleError(`أدخل سعر البيع للمقاس ${r.size}`);
    if (!Number.isInteger(r.cost) || r.cost < 0)
      throw new RuleError(`أدخل التكلفة للمقاس ${r.size} (0 إذا كانت غير معروفة)`);
    if (!Number.isInteger(r.stock) || r.stock < 0)
      throw new RuleError(`أدخل الكمية للمقاس ${r.size}`);
  }
  return ctx.db.transaction(() => {
    const designId = input.designId ?? newDesignId(ctx);
    const kept = new Set(rows.map((r) => r.productId).filter((id): id is number => !!id));
    const existing = ctx.db.all<{ id: number }>(
      'SELECT id FROM products WHERE design_id = ? AND archived = 0',
      [designId],
    );
    for (const { id } of existing) if (!kept.has(id)) deleteProduct(ctx, id);
    for (const r of rows) {
      saveProduct(ctx, {
        id: r.productId,
        name: input.name,
        brand: input.brand,
        color: input.color,
        category: input.category,
        size: r.size,
        price: r.price,
        cost: r.cost,
        stock: r.stock,
        lowStock: r.lowStock ?? 2,
        imageFile: input.imageFile ?? null,
        designId,
      });
    }
    return designId;
  });
}

/** Deletes every size of a design (sizes that were sold are archived). */
export function deleteScarfDesign(ctx: Ctx, designId: string) {
  ctx.db.transaction(() => {
    const ids = ctx.db.all<{ id: number }>(
      'SELECT id FROM products WHERE design_id = ? AND archived = 0',
      [designId],
    );
    for (const { id } of ids) deleteProduct(ctx, id);
  });
}

/** Sizes currently used by any scarf (for the size filter), smallest first. */
export function sizesInUse(ctx: Ctx): string[] {
  return ctx.db
    .all<{ size: string }>(
      'SELECT DISTINCT size FROM products WHERE size IS NOT NULL AND archived = 0',
    )
    .map((r) => r.size)
    .sort((a, b) => sizeSortKey(a) - sizeSortKey(b));
}
