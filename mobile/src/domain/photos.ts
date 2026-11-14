import type { Ctx } from './context';

/**
 * A new, never-repeating photo file name for this system: "jewelry-mh8k2l3a-x7f2qp.jpg".
 * Only the name is stored in the database; the file lives in the app's own folder.
 */
export function newPhotoName(ctx: Ctx, random: () => number = Math.random): string {
  const time = ctx.now().getTime().toString(36);
  const tail = random().toString(36).slice(2, 8).padEnd(6, '0');
  return `${ctx.system}-${time}-${tail}.jpg`;
}

/**
 * Is this photo still shown anywhere? All sizes of a scarf design share one photo, and archived
 * products can be restored, so a file is only removed once nothing at all points to it.
 */
export function photoInUse(ctx: Ctx, file: string): boolean {
  return !!ctx.db.get(
    `SELECT 1 FROM products WHERE image_file = ? UNION ALL SELECT 1 FROM brands WHERE image_file = ?
     UNION ALL SELECT 1 FROM customers WHERE image_file = ? LIMIT 1`,
    [file, file, file],
  );
}
