import { LATEST_VERSION } from '@/db/schema';
import type { Db, SqlValue } from '@/db/types';
import type { SystemId } from '@/theme';

import { allow, nowStamp, RuleError, type Ctx } from './context';
import { logAction } from './activity';

/**
 * A backup is one JSON file holding every table of one system. It carries a format name, its own
 * version, the schema version, which system it belongs to, and a checksum of its data, so a
 * damaged file, another system's file or a file from a newer app is refused before anything is
 * changed. (Photos are added to the file by the backup screen in Phase 7.)
 */
export const BACKUP_FORMAT = 'salford-pos-backup';
export const BACKUP_VERSION = 1;

/** Parents before children, so restoring in this order satisfies every foreign key. */
export const TABLES = [
  'settings',
  'brands',
  'products',
  'stock_moves',
  'customers',
  'sales',
  'sale_lines',
  'returns',
  'payments',
  'expenses',
  'sets',
  'set_items',
  'receipts',
  'receipt_items',
  'closings',
  'activity',
  'staff_ledger',
] as const;

type Row = Record<string, SqlValue>;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  schema: number;
  system: SystemId;
  exportedAt: string;
  /** Last id handed out per table, so restored ids are never reused. */
  sequences: Record<string, number>;
  tables: Record<string, Row[]>;
  checksum: string;
};

/** FNV-1a 32-bit hash: detects a changed or truncated file (not a security measure). */
export function checksumOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const payload = (b: Pick<Backup, 'system' | 'schema' | 'sequences' | 'tables'>) =>
  JSON.stringify({ system: b.system, schema: b.schema, sequences: b.sequences, tables: b.tables });

export function exportBackup(ctx: Ctx): Backup {
  const tables: Record<string, Row[]> = {};
  for (const t of TABLES) tables[t] = ctx.db.all<Row>(`SELECT * FROM ${t}`);
  const sequences: Record<string, number> = {};
  for (const r of ctx.db.all<{ name: string; seq: number }>(
    'SELECT name, seq FROM sqlite_sequence',
  ))
    sequences[r.name] = r.seq;
  const body = { system: ctx.system, schema: LATEST_VERSION, sequences, tables };
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowStamp(ctx),
    ...body,
    checksum: checksumOf(payload(body)),
  };
}

const SYSTEM_NAMES: Record<SystemId, string> = { jewelry: 'المجوهرات', scarves: 'الأوشحة' };

/** Checks a backup file without changing anything. Throws a RuleError explaining what is wrong. */
export function validateBackup(ctx: Ctx, data: unknown): Backup {
  const b = data as Partial<Backup> | null;
  if (
    !b ||
    typeof b !== 'object' ||
    b.format !== BACKUP_FORMAT ||
    !b.tables ||
    typeof b.tables !== 'object'
  ) {
    throw new RuleError('هذا الملف ليس نسخة احتياطية من SALFORD POS');
  }
  if (
    typeof b.version !== 'number' ||
    b.version > BACKUP_VERSION ||
    typeof b.schema !== 'number' ||
    b.schema > LATEST_VERSION
  ) {
    throw new RuleError('هذه النسخة من إصدار أحدث من التطبيق. حدّث التطبيق ثم أعد المحاولة');
  }
  if (b.system !== ctx.system) {
    throw new RuleError(
      `هذه نسخة نظام ${SYSTEM_NAMES[b.system as SystemId] ?? 'آخر'}، لا يمكن استعادتها في نظام ${SYSTEM_NAMES[ctx.system]}`,
    );
  }
  if (b.checksum !== checksumOf(payload(b as Backup))) {
    throw new RuleError('ملف النسخة الاحتياطية تالف أو غير مكتمل');
  }
  for (const name of Object.keys(b.tables)) {
    if (!(TABLES as readonly string[]).includes(name))
      throw new RuleError('ملف النسخة الاحتياطية يحتوي على بيانات غير معروفة');
  }
  return b as Backup;
}

/** A short description for the confirmation screen ("120 قطعة، 340 بيعة…"). */
export function backupContents(b: Backup) {
  const n = (t: string) => b.tables[t]?.length ?? 0;
  return {
    products: n('products'),
    sales: n('sales'),
    customers: n('customers'),
    receipts: n('receipts'),
    exportedAt: b.exportedAt,
  };
}

/** The numbers already handed out (record ids, the receipt counter), read before a restore. */
export type UsedNumbers = {
  seq: { name: string; seq: number }[];
  receiptYear?: string;
  receiptCounter: number;
};

const settingOf = (db: Db, key: string) =>
  db.get<{ value: string }>('SELECT value FROM main.settings WHERE key = ?', [key])?.value;

export function usedNumbers(db: Db): UsedNumbers {
  return {
    seq: db.all<{ name: string; seq: number }>('SELECT name, seq FROM main.sqlite_sequence'),
    receiptYear: settingOf(db, 'receipt_year'),
    receiptCounter: Number(settingOf(db, 'receipt_counter') ?? 0),
  };
}

/**
 * After a restore: numbers continue after the highest ever used, here or in the backup, so an
 * older backup never makes the app give out a sale or receipt number again (a printed receipt
 * number never repeats).
 */
export function keepUsedNumbers(db: Db, used: UsedNumbers) {
  for (const u of used.seq) {
    if (!(TABLES as readonly string[]).includes(u.name)) continue;
    const r = db.run('UPDATE main.sqlite_sequence SET seq = max(seq, ?) WHERE name = ?', [
      u.seq,
      u.name,
    ]);
    if (r.changes === 0)
      db.run('INSERT INTO main.sqlite_sequence (name, seq) VALUES (?, ?)', [u.name, u.seq]);
  }
  if (!used.receiptYear) return;
  const year = settingOf(db, 'receipt_year');
  const counter = Number(settingOf(db, 'receipt_counter') ?? 0);
  const put = (key: string, value: string) =>
    db.run(
      'INSERT INTO main.settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  if (!year || Number(used.receiptYear) > Number(year)) {
    put('receipt_year', used.receiptYear);
    put('receipt_counter', String(used.receiptCounter));
  } else if (year === used.receiptYear && used.receiptCounter > counter) {
    put('receipt_counter', String(used.receiptCounter));
  }
}

/**
 * Replaces this system's data with a backup, all-or-nothing. The file is validated first; the
 * current data is exported and returned as a safety copy BEFORE anything changes (the caller
 * saves it), so a restore can always be undone.
 */
export function restoreBackup(ctx: Ctx, data: unknown): { safetyCopy: Backup } {
  allow(ctx, 'backup.restore');
  const b = validateBackup(ctx, data);
  const safetyCopy = exportBackup(ctx);
  ctx.db.transaction(() => {
    const used = usedNumbers(ctx.db);
    for (const t of [...TABLES].reverse()) ctx.db.run(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      const columns = new Set(
        ctx.db.all<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name),
      );
      for (const row of b.tables[t] ?? []) {
        const keys = Object.keys(row).filter((k) => columns.has(k));
        if (keys.length === 0) continue;
        ctx.db.run(
          `INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map((k) => row[k]),
        );
      }
    }
    ctx.db.run('DELETE FROM sqlite_sequence');
    for (const [name, seq] of Object.entries(b.sequences ?? {})) {
      if ((TABLES as readonly string[]).includes(name))
        ctx.db.run('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)', [name, seq]);
    }
    keepUsedNumbers(ctx.db, used);
    logAction(ctx, 'backup.restore', `استرجاع نسخة احتياطية من ${b.exportedAt.replace('T', ' ')}`, {
      madeAt: b.exportedAt,
    });
  });
  return { safetyCopy };
}
