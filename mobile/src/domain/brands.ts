import { clean, nowStamp, RuleError, type Ctx } from './context';

export type Brand = { id: number; name: string; imageFile: string | null; productCount: number };

type BrandRow = { id: number; name: string; image_file: string | null; product_count: number };

/** The brand with this name ignoring case and spaces ("pandora " finds "Pandora"). */
export function findBrand(ctx: Ctx, name: string): { id: number; name: string } | undefined {
  const t = clean(name);
  if (!t) return undefined;
  return ctx.db.get<{ id: number; name: string }>(
    'SELECT id, name FROM brands WHERE name = ? COLLATE NOCASE',
    [t],
  );
}

/** The id of the brand with this name, creating it if it is new. null for an empty name. */
export function ensureBrand(ctx: Ctx, name: string | null | undefined): number | null {
  const t = clean(name);
  if (!t) return null;
  const existing = findBrand(ctx, t);
  if (existing) return existing.id;
  return ctx.db.run('INSERT INTO brands (name, created_at) VALUES (?, ?)', [t, nowStamp(ctx)])
    .lastInsertRowId;
}

export function addBrand(ctx: Ctx, name: string): number {
  const id = ensureBrand(ctx, name);
  if (id === null) throw new RuleError('اكتب اسم الماركة');
  return id;
}

/** Brands A–Z with how many (not archived) products each has. */
export function listBrands(ctx: Ctx): Brand[] {
  return ctx.db
    .all<BrandRow>(
      `SELECT b.id, b.name, b.image_file,
              (SELECT count(*) FROM products p WHERE p.brand_id = b.id AND p.archived = 0) AS product_count
         FROM brands b ORDER BY b.name COLLATE NOCASE`,
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      imageFile: r.image_file,
      productCount: r.product_count,
    }));
}

/** Renames a brand; every product with it shows the new name. Past sales keep the old name. */
export function renameBrand(ctx: Ctx, id: number, newName: string) {
  const t = clean(newName);
  if (!t) throw new RuleError('اكتب اسم الماركة');
  const other = findBrand(ctx, t);
  if (other && other.id !== id) throw new RuleError(`الماركة «${other.name}» موجودة بالفعل`);
  ctx.db.run('UPDATE brands SET name = ? WHERE id = ?', [t, id]);
}

/** Deletes a brand; its products become "no brand". Past sales keep the name they were sold with. */
export function deleteBrand(ctx: Ctx, id: number) {
  ctx.db.run('DELETE FROM brands WHERE id = ?', [id]);
}

export function setBrandImage(ctx: Ctx, id: number, imageFile: string | null) {
  ctx.db.run('UPDATE brands SET image_file = ? WHERE id = ?', [imageFile, id]);
}
