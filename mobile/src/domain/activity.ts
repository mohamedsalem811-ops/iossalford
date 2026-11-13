/**
 * The activity log (phase S3): one line for every action that changes data, every sign-in and
 * every wrong PIN. Lines are only ever added, in the same transaction as the action (both are
 * saved or neither). Each line carries the SHA-256 fingerprint of the line before it plus its own
 * content (a hash chain, as in bank ledgers): a line changed or removed outside the app breaks the
 * chain, and verifyLog finds where.
 */
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

import { dayKey } from '@/lib/dates';
import { actorKey, actorName, type Actor } from '@/staff/model';

import { allowView, nowStamp, pageSql, PermissionError, type Ctx, type Page } from './context';

/** The "line before" the first line. */
export const GENESIS = '0'.repeat(64);

export type ActivityLine = {
  id: number;
  at: string;
  day: string;
  actor: string;
  actorName: string;
  /** A fixed name, e.g. "sale.create", "signin", "pin.wrong". */
  action: string;
  /** Arabic, ready to show: "بيع 2 قطعة بـ 700.000 د.ل". */
  summary: string;
  details: Record<string, unknown> | null;
  hash: string;
};

type Row = {
  id: number;
  at: string;
  day: string;
  actor: string;
  actor_name: string;
  action: string;
  summary: string;
  details: string | null;
  prev_hash: string;
  hash: string;
};

/** The fingerprint of a line: its content and the line before it. */
export function lineHash(
  prev: string,
  l: Pick<Row, 'id' | 'at' | 'actor' | 'actor_name' | 'action' | 'summary' | 'details'>,
): string {
  const text = JSON.stringify([
    prev,
    l.id,
    l.at,
    l.actor,
    l.actor_name,
    l.action,
    l.summary,
    l.details,
  ]);
  return bytesToHex(sha256(utf8ToBytes(text)));
}

function lastHash(ctx: Ctx): { id: number; hash: string } {
  return (
    ctx.db.get<{ id: number; hash: string }>(
      'SELECT id, hash FROM activity ORDER BY id DESC LIMIT 1',
    ) ?? { id: 0, hash: GENESIS }
  );
}

/** Adds a line for someone (sign-ins and wrong PINs name the person; actions use logAction). */
export function logAs(
  ctx: Ctx,
  person: { key: string; name: string },
  action: string,
  summary: string,
  details?: Record<string, unknown>,
): void {
  ctx.db.transaction(() => {
    const prev = lastHash(ctx);
    const line = {
      // AUTOINCREMENT ids only grow; the chain also covers the id, so lines can't be reordered.
      id:
        Math.max(
          prev.id,
          ctx.db.get<{ seq: number }>("SELECT seq FROM sqlite_sequence WHERE name = 'activity'")
            ?.seq ?? 0,
        ) + 1,
      at: nowStamp(ctx),
      actor: person.key,
      actor_name: person.name,
      action,
      summary,
      details: details ? JSON.stringify(details) : null,
    };
    ctx.db.run(
      `INSERT INTO activity (id, at, day, actor, actor_name, action, summary, details, prev_hash, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        line.id,
        line.at,
        dayKey(ctx.now()),
        line.actor,
        line.actor_name,
        line.action,
        line.summary,
        line.details,
        prev.hash,
        lineHash(prev.hash, line),
      ],
    );
  });
}

export const personOf = (a: Actor) => ({ key: actorKey(a), name: actorName(a) });

/**
 * The log line of an action, by whoever is signed in. Called inside the action's own
 * transaction, after its changes, so the action and its line are saved together or not at all.
 */
export function logAction(
  ctx: Ctx,
  action: string,
  summary: string,
  details?: Record<string, unknown>,
): void {
  const actor = ctx.actor;
  if (!actor) throw new PermissionError('سجّل الدخول أولاً.');
  logAs(ctx, personOf(actor), action, summary, details);
}

export type LogCheck = {
  /** True when no line was changed or removed. */
  ok: boolean;
  lines: number;
  /** The newest line, to remember outside the database. */
  last: { id: number; hash: string };
  /**
   * Lines whose fingerprint doesn't match: each one, or one just before it, was changed or
   * removed. The walk goes on after a break (from the line as it is), so a later change is found
   * even after the owner has seen an earlier one.
   */
  broken: number[];
};

/**
 * Walks the whole chain a page at a time (memory stays small), pausing after each page so the
 * app can run the walk in pieces (`yield`) without holding the screen. `anchor` is the last line
 * remembered outside the database: it must still be there with the same fingerprint, so removing
 * lines from the end is found too.
 */
export function* walkLog(
  ctx: Ctx,
  anchor?: { id: number; hash: string } | null,
  pageSize = 500,
): Generator<void, LogCheck, void> {
  let prev = GENESIS;
  let lines = 0;
  let last = { id: 0, hash: GENESIS };
  let after = 0;
  const broken: number[] = [];
  for (;;) {
    const rows = ctx.db.all<Row>('SELECT * FROM activity WHERE id > ? ORDER BY id LIMIT ?', [
      after,
      pageSize,
    ]);
    if (rows.length === 0) break;
    for (const r of rows) {
      if (r.prev_hash !== prev || lineHash(r.prev_hash, r) !== r.hash) broken.push(r.id);
      prev = r.hash;
      last = { id: r.id, hash: r.hash };
      lines++;
    }
    after = rows[rows.length - 1].id;
    yield;
  }
  if (anchor && anchor.id > 0) {
    const kept = ctx.db.get<{ hash: string }>('SELECT hash FROM activity WHERE id = ?', [
      anchor.id,
    ]);
    if ((!kept || kept.hash !== anchor.hash) && !broken.includes(anchor.id)) broken.push(anchor.id);
  }
  return { ok: broken.length === 0, lines, last, broken };
}

/** The whole walk at once (tests, small logs). */
export function verifyLog(ctx: Ctx, anchor?: { id: number; hash: string } | null): LogCheck {
  const walk = walkLog(ctx, anchor, 1000);
  for (;;) {
    const step = walk.next();
    if (step.done) return step.value;
  }
}

export type ActivityQuery = { actor?: string; day?: string };

function filter(q: ActivityQuery) {
  const where: string[] = [];
  const params: string[] = [];
  if (q.actor) {
    where.push('actor = ?');
    params.push(q.actor);
  }
  if (q.day) {
    where.push('day = ?');
    params.push(q.day);
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

const toLine = (r: Row): ActivityLine => ({
  id: r.id,
  at: r.at,
  day: r.day,
  actor: r.actor,
  actorName: r.actor_name,
  action: r.action,
  summary: r.summary,
  details: r.details ? (JSON.parse(r.details) as Record<string, unknown>) : null,
  hash: r.hash,
});

/** The log, newest first, by person and day; a page at a time. The owner only. */
export function listActivity(ctx: Ctx, q: ActivityQuery = {}, page?: Page): ActivityLine[] {
  allowView(ctx, 'log.view');
  const f = filter(q);
  return ctx.db
    .all<Row>(`SELECT * FROM activity ${f.where} ORDER BY id DESC${pageSql(page)}`, f.params)
    .map(toLine);
}

export function countActivity(ctx: Ctx, q: ActivityQuery = {}): number {
  allowView(ctx, 'log.view');
  const f = filter(q);
  return ctx.db.get<{ n: number }>(`SELECT count(*) n FROM activity ${f.where}`, f.params)?.n ?? 0;
}

/** The people who appear in the log (for the filter), with their latest name. */
export function activityPeople(ctx: Ctx): { key: string; name: string }[] {
  allowView(ctx, 'log.view');
  return ctx.db.all<{ key: string; name: string }>(
    `SELECT actor AS key, actor_name AS name FROM activity
      WHERE id IN (SELECT max(id) FROM activity GROUP BY actor) ORDER BY actor_name`,
  );
}

/** Days that have lines, newest first ("2026-11-13"). */
export function activityDays(ctx: Ctx, limit = 60): string[] {
  allowView(ctx, 'log.view');
  return ctx.db
    .all<{ day: string }>('SELECT DISTINCT day FROM activity ORDER BY day DESC LIMIT ?', [limit])
    .map((r) => r.day);
}

// ---------- Events with a named person (not an action of whoever is signed in) ----------

/** Someone signed in to this system. */
export const recordSignIn = (ctx: Ctx, a: Actor) =>
  logAs(ctx, personOf(a), 'signin', `دخول ${actorName(a)}`);

/** A wrong PIN for someone's account; `lockedFor` when it locked the account. */
export const recordWrongPin = (ctx: Ctx, a: Actor, lockedFor?: number) =>
  logAs(
    ctx,
    personOf(a),
    lockedFor ? 'pin.locked' : 'pin.wrong',
    lockedFor
      ? `رمز خاطئ لـ ${actorName(a)}: أُقفل الحساب ${Math.ceil(lockedFor / 60_000)} دقيقة`
      : `رمز خاطئ لـ ${actorName(a)}`,
  );

/** The emergency code was used to set a new owner PIN. */
export const recordEmergency = (ctx: Ctx) =>
  logAs(
    ctx,
    { key: 'owner', name: 'المالك' },
    'pin.emergency',
    'استُخدم رمز الطوارئ لتعيين رمز جديد',
  );

/** Staff changes (the list is shared by both systems; the line goes to the open one). */
export const recordStaff = (ctx: Ctx, summary: string, details?: Record<string, unknown>) =>
  logAction(ctx, 'staff.change', summary, details);

/** The device clock went back before the latest time seen (S3.4). */
export const recordClockBack = (ctx: Ctx, latest: Date, now: Date) =>
  logAs(
    ctx,
    ctx.actor ? personOf(ctx.actor) : { key: 'system', name: 'النظام' },
    'clock.back',
    `ساعة الجهاز رجعت للخلف: ${now.toISOString()} بعد ${latest.toISOString()}`,
    { latest: latest.toISOString(), now: now.toISOString() },
  );

/** The owner accepted the device's time as correct after it went back. */
export function recordClockAccepted(ctx: Ctx) {
  // Not `allow`: that refuses every change while the clock is behind, this one included.
  allowView(ctx, 'settings.edit');
  logAction(ctx, 'clock.accept', 'قبول وقت الجهاز الحالي');
}

/** The log's chain was found broken (a line changed or removed outside the app). */
export const recordLogBroken = (ctx: Ctx, brokenAt: number) =>
  logAs(
    ctx,
    { key: 'system', name: 'النظام' },
    'log.broken',
    `السجل تغيّر خارج التطبيق عند السطر ${brokenAt}`,
    { brokenAt },
  );

/** The newest line (to remember outside the database), without walking the chain. */
export const lastLine = (ctx: Ctx) => lastHash(ctx);
