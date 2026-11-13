/**
 * The stock count (جرد, phase S6). Anyone who sells may count the pieces, without ever seeing
 * the stock (a blind count): the count sheet has no stock figure. Each piece's stock at the
 * moment it is counted is kept with the line, hidden, so a sale made later in the count does
 * not show as a difference. The person sends the count to the owner, who sees the differences
 * and applies them as stock changes with the reason "جرد", or cancels the count.
 *
 * One count is open at a time per system. Pieces nobody counted are left as they are.
 */
import { latinDigits } from '@/lib/digits';
import { formatLyd } from '@/lib/money';

import { logAction } from './activity';
import {
  allow,
  allowView,
  clean,
  nowStamp,
  pageSql,
  RuleError,
  who,
  type Ctx,
  type Page,
} from './context';

export type CountStatus = 'open' | 'submitted' | 'applied' | 'cancelled';

export const COUNT_STATUS_LABELS: Record<CountStatus, string> = {
  open: 'جارٍ',
  submitted: 'بانتظار المالك',
  applied: 'طُبّق',
  cancelled: 'أُلغي',
};

export type StockCount = {
  id: number;
  status: CountStatus;
  startedAt: string;
  byName: string;
  submittedAt: string | null;
  submittedByName: string | null;
  doneAt: string | null;
  doneByName: string | null;
  note: string | null;
  /** Pieces counted so far. */
  pieces: number;
};

type CountRow = {
  id: number;
  status: CountStatus;
  started_at: string;
  by_name: string;
  submitted_at: string | null;
  submitted_by_name: string | null;
  done_at: string | null;
  done_by_name: string | null;
  note: string | null;
  pieces: number;
};

const SELECT_COUNT = `SELECT c.*, (SELECT count(*) FROM stock_count_lines l WHERE l.count_id = c.id) pieces
  FROM stock_counts c`;

const toCount = (r: CountRow): StockCount => ({
  id: r.id,
  status: r.status,
  startedAt: r.started_at,
  byName: r.by_name,
  submittedAt: r.submitted_at,
  submittedByName: r.submitted_by_name,
  doneAt: r.done_at,
  doneByName: r.done_by_name,
  note: r.note,
  pieces: r.pieces,
});

/** The most pieces of one product a count accepts: a typo guard. */
export const MAX_COUNTED = 100_000;

export function getCount(ctx: Ctx, id: number): StockCount | undefined {
  const r = ctx.db.get<CountRow>(`${SELECT_COUNT} WHERE c.id = ?`, [id]);
  return r ? toCount(r) : undefined;
}

/** The count in progress, if any (it shows no stock, so anyone may read it). */
export function openCount(ctx: Ctx): StockCount | undefined {
  const r = ctx.db.get<CountRow>(`${SELECT_COUNT} WHERE c.status = 'open'`);
  return r ? toCount(r) : undefined;
}

const label = (name: string, size: string | null) => (size ? `${name} (${size})` : name);

function requireOpen(ctx: Ctx, id: number): StockCount {
  const count = getCount(ctx, id);
  if (!count) throw new RuleError('الجرد غير موجود');
  if (count.status !== 'open') throw new RuleError('هذا الجرد أُرسل أو أُغلق، ابدأ جرداً جديداً');
  return count;
}

export function startCount(ctx: Ctx, note?: string): number {
  allow(ctx, 'stock.count');
  return ctx.db.transaction(() => {
    if (openCount(ctx)) throw new RuleError('يوجد جرد جارٍ، أكمله أولاً');
    const [key, name] = who(ctx);
    const id = ctx.db.run(
      `INSERT INTO stock_counts (status, started_at, by, by_name, note) VALUES ('open', ?, ?, ?, ?)`,
      [nowStamp(ctx), key, name, clean(note)],
    ).lastInsertRowId;
    logAction(ctx, 'count.start', `بدء الجرد رقم ${id}`, { countId: id });
    return id;
  });
}

/** A row of the count sheet: the piece and what was counted, never its stock. */
export type CountSheetRow = {
  productId: number;
  name: string;
  size: string | null;
  sku: string;
  counted: number | null;
};

/** The pieces to count (not archived), by name; search by name or code. */
export function countSheet(
  ctx: Ctx,
  countId: number,
  search?: string,
  page?: Page,
): CountSheetRow[] {
  const where = ['p.archived = 0'];
  const params: (string | number)[] = [countId];
  const s = clean(latinDigits(search ?? ''));
  if (s) {
    where.push('(p.name LIKE ? OR p.sku LIKE ?)');
    params.push(`%${s}%`, `%${s}%`);
  }
  return ctx.db
    .all<{
      id: number;
      name: string;
      size: string | null;
      sku: string;
      counted: number | null;
    }>(
      `SELECT p.id, p.name, p.size, p.sku, l.counted FROM products p
         LEFT JOIN stock_count_lines l ON l.product_id = p.id AND l.count_id = ?
        WHERE ${where.join(' AND ')}
        ORDER BY p.name COLLATE NOCASE, p.size, p.id${pageSql(page)}`,
      params,
    )
    .map((r) => ({
      productId: r.id,
      name: r.name,
      size: r.size,
      sku: r.sku,
      counted: r.counted,
    }));
}

/** How many pieces are counted, of how many to count. */
export function countProgress(ctx: Ctx, countId: number): { counted: number; total: number } {
  return (
    ctx.db.get<{ counted: number; total: number }>(
      `SELECT (SELECT count(*) FROM stock_count_lines WHERE count_id = ?) counted,
              (SELECT count(*) FROM products WHERE archived = 0) total`,
      [countId],
    ) ?? { counted: 0, total: 0 }
  );
}

/**
 * Records how many of a piece were found (again, to correct it). The stock at this moment is
 * kept with the line, hidden, so later sales are not counted as differences.
 */
export function countPiece(ctx: Ctx, countId: number, productId: number, counted: number): void {
  allow(ctx, 'stock.count');
  if (!Number.isInteger(counted) || counted < 0 || counted > MAX_COUNTED)
    throw new RuleError('اكتب عدد القطع الموجودة (صفر أو أكثر)');
  ctx.db.transaction(() => {
    requireOpen(ctx, countId);
    const p = ctx.db.get<{ name: string; size: string | null; stock: number; archived: number }>(
      'SELECT name, size, stock, archived FROM products WHERE id = ?',
      [productId],
    );
    if (!p || p.archived) throw new RuleError('القطعة غير موجودة في المخزون');
    const [key, name] = who(ctx);
    ctx.db.run(
      `INSERT INTO stock_count_lines (count_id, product_id, counted, expected, counted_at, by, by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (count_id, product_id) DO UPDATE SET counted = excluded.counted,
         expected = excluded.expected, counted_at = excluded.counted_at, by = excluded.by,
         by_name = excluded.by_name`,
      [countId, productId, counted, p.stock, nowStamp(ctx), key, name],
    );
    logAction(ctx, 'count.piece', `جرد رقم ${countId}: «${label(p.name, p.size)}» ${counted}`, {
      countId,
      productId,
      counted,
    });
  });
}

/** The person has finished: the count goes to the owner. */
export function submitCount(ctx: Ctx, countId: number): void {
  allow(ctx, 'stock.count');
  ctx.db.transaction(() => {
    const count = requireOpen(ctx, countId);
    if (count.pieces === 0) throw new RuleError('لم تُعدّ أي قطعة بعد');
    const [key, name] = who(ctx);
    ctx.db.run(
      `UPDATE stock_counts SET status = 'submitted', submitted_at = ?, submitted_by = ?,
         submitted_by_name = ? WHERE id = ?`,
      [nowStamp(ctx), key, name, countId],
    );
    logAction(ctx, 'count.submit', `إنهاء الجرد رقم ${countId}: ${count.pieces} قطعة عُدّت`, {
      countId,
      pieces: count.pieces,
    });
  });
}

export type CountLine = {
  productId: number;
  name: string;
  size: string | null;
  sku: string;
  expected: number;
  counted: number;
  /** Counted − expected: negative is missing. */
  difference: number;
  /** What the owner's apply changed in the stock (null until applied). */
  applied: number | null;
  /** The difference at cost (for the owner). */
  costDifference: number;
  countedByName: string | null;
};

export type CountResult = {
  count: StockCount;
  /** Every counted piece, those with a difference first. */
  lines: CountLine[];
  matching: number;
  missingPieces: number;
  extraPieces: number;
  /** Missing and extra pieces at cost (missing negative). */
  costDifference: number;
  /** Pieces in the shop nobody counted (left as they are). */
  uncounted: number;
};

/** The owner reads the differences of a count. */
export function countResult(ctx: Ctx, countId: number): CountResult | undefined {
  allowView(ctx, 'counts.view');
  const count = getCount(ctx, countId);
  if (!count) return undefined;
  const lines = ctx.db
    .all<{
      product_id: number;
      name: string;
      size: string | null;
      sku: string;
      expected: number | null;
      stock: number;
      counted: number;
      applied: number | null;
      cost: number;
      by_name: string | null;
    }>(
      `SELECT l.product_id, p.name, p.size, p.sku, l.expected, p.stock, l.counted, l.applied, p.cost,
              l.by_name
         FROM stock_count_lines l JOIN products p ON p.id = l.product_id
        WHERE l.count_id = ?`,
      [countId],
    )
    .map((r): CountLine => {
      const expected = r.expected ?? r.stock;
      const difference = r.counted - expected;
      return {
        productId: r.product_id,
        name: r.name,
        size: r.size,
        sku: r.sku,
        expected,
        counted: r.counted,
        difference,
        applied: r.applied,
        costDifference: difference * r.cost,
        countedByName: r.by_name,
      };
    })
    .sort(
      (a, b) =>
        Number(b.difference !== 0) - Number(a.difference !== 0) ||
        a.difference - b.difference ||
        a.name.localeCompare(b.name, 'ar'),
    );
  const uncounted =
    ctx.db.get<{ n: number }>(
      `SELECT count(*) n FROM products p WHERE p.archived = 0
         AND NOT EXISTS (SELECT 1 FROM stock_count_lines l WHERE l.count_id = ? AND l.product_id = p.id)`,
      [countId],
    )?.n ?? 0;
  return {
    count,
    lines,
    matching: lines.filter((l) => l.difference === 0).length,
    missingPieces: lines.reduce((t, l) => t + Math.max(0, -l.difference), 0),
    extraPieces: lines.reduce((t, l) => t + Math.max(0, l.difference), 0),
    costDifference: lines.reduce((t, l) => t + l.costDifference, 0),
    uncounted,
  };
}

/** Every count, newest first (the owner). */
export function listCounts(ctx: Ctx, page?: Page): StockCount[] {
  allowView(ctx, 'counts.view');
  return ctx.db.all<CountRow>(`${SELECT_COUNT} ORDER BY c.id DESC${pageSql(page)}`).map(toCount);
}

/**
 * The owner applies a sent count: each difference changes the stock as an adjustment with the
 * reason "جرد رقم N" (in the piece's stock history). The difference is added to the stock as it
 * is now, so sales since the piece was counted stay counted; stock never goes below 0.
 */
export function applyCount(
  ctx: Ctx,
  countId: number,
): { changed: number; missing: number; extra: number } {
  allow(ctx, 'stock.adjust');
  return ctx.db.transaction(() => {
    const count = getCount(ctx, countId);
    if (!count) throw new RuleError('الجرد غير موجود');
    if (count.status !== 'submitted')
      throw new RuleError(
        count.status === 'open' ? 'لم يُنهِ الجرد بعد' : 'هذا الجرد طُبّق أو أُلغي من قبل',
      );
    const reason = `جرد رقم ${countId}`;
    const stamp = nowStamp(ctx);
    const [key, name] = who(ctx);
    let changed = 0;
    let missing = 0;
    let extra = 0;
    for (const l of ctx.db.all<{
      id: number;
      product_id: number;
      counted: number;
      expected: number | null;
      stock: number;
    }>(
      `SELECT l.id, l.product_id, l.counted, l.expected, p.stock
         FROM stock_count_lines l JOIN products p ON p.id = l.product_id WHERE l.count_id = ?`,
      [countId],
    )) {
      const difference = l.counted - (l.expected ?? l.stock);
      const delta = Math.max(difference, -l.stock);
      ctx.db.run('UPDATE stock_count_lines SET applied = ? WHERE id = ?', [delta, l.id]);
      if (delta === 0) continue;
      ctx.db.run('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?', [
        delta,
        stamp,
        l.product_id,
      ]);
      ctx.db.run(
        `INSERT INTO stock_moves (product_id, delta, kind, reason, ref_id, created_at, by, by_name)
         VALUES (?, ?, 'adjust', ?, ?, ?, ?, ?)`,
        [l.product_id, delta, reason, countId, stamp, key, name],
      );
      changed += 1;
      if (delta < 0) missing += -delta;
      else extra += delta;
    }
    ctx.db.run(
      `UPDATE stock_counts SET status = 'applied', done_at = ?, done_by = ?, done_by_name = ? WHERE id = ?`,
      [stamp, key, name, countId],
    );
    logAction(
      ctx,
      'count.apply',
      `تطبيق الجرد رقم ${countId}: ${changed} قطعة تغيّر مخزونها (ناقص ${missing}، زائد ${extra})`,
      { countId, changed, missing, extra },
    );
    return { changed, missing, extra };
  });
}

/** The owner cancels a count (in progress or sent): the stock is not changed. */
export function cancelCount(ctx: Ctx, countId: number, why?: string): void {
  allow(ctx, 'stock.adjust');
  ctx.db.transaction(() => {
    const count = getCount(ctx, countId);
    if (!count) throw new RuleError('الجرد غير موجود');
    if (count.status !== 'open' && count.status !== 'submitted')
      throw new RuleError('هذا الجرد طُبّق أو أُلغي من قبل');
    const [key, name] = who(ctx);
    ctx.db.run(
      `UPDATE stock_counts SET status = 'cancelled', done_at = ?, done_by = ?, done_by_name = ?,
         note = coalesce(?, note) WHERE id = ?`,
      [nowStamp(ctx), key, name, clean(why), countId],
    );
    logAction(ctx, 'count.cancel', `إلغاء الجرد رقم ${countId}`, { countId });
  });
}

/** "ناقص 2 قطعة • 140 د.ل" for the owner's summary. */
export function costText(costDifference: number): string {
  return costDifference === 0
    ? ''
    : `${costDifference < 0 ? '−' : '+'}${formatLyd(Math.abs(costDifference))}`;
}
