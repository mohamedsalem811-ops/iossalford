import type { Db } from '@/db/types';
import { monthKey } from '@/lib/dates';
import { actorKey, actorName, type Actor } from '@/staff/model';
import { can, refusal, WRITES, type Permission } from '@/staff/permissions';
import type { SystemId } from '@/theme';

/**
 * What every business rule works with: the system's database, which system it is, the clock and
 * who is doing it. `actor` is required, so no call can leave out the person; null means nobody is
 * signed in (or the employee was suspended), and every action is then refused.
 */
export type Ctx = {
  db: Db;
  system: SystemId;
  /** The current time; tests pass a fixed clock. */
  now: () => Date;
  /** Who is signed in now (read when the action runs, not when the screen opened). */
  readonly actor: Actor | null;
  /**
   * The clock guard (staff/clock.ts): refuses every action while the device clock is behind the
   * latest time seen. Absent in tests that don't test it.
   */
  clock?: { check(now: Date): string | null };
};

/** Local ISO timestamp without a time-zone suffix: "2026-11-09T14:05:00". */
export function timestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export const nowStamp = (ctx: Ctx) => timestamp(ctx.now());
export const nowMonth = (ctx: Ctx) => monthKey(ctx.now());

/** A rule refusing an action. The message is Arabic, ready to show; nothing was changed. */
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleError';
  }
}

/**
 * The first line of every business rule that changes data: refuses, with an Arabic message and
 * before anything is written, when this person may not do it. Returns the person.
 */
export function allow(ctx: Ctx, permission: Permission): Actor {
  const actor = ctx.actor;
  if (!actor || !can(actor, permission)) throw new PermissionError(refusal(actor, permission));
  // Only for changes: reading is never blocked by the clock.
  if (permission in WRITES) {
    const problem = ctx.clock?.check(ctx.now());
    if (problem) throw new ClockError(problem);
  }
  return actor;
}

/**
 * The first line of a report that shows money only the owner sees (profit, cost, every sale):
 * refuses like `allow`, for reading. A screen that should not show it never calls it; this is the
 * layer behind that.
 */
export function allowView(ctx: Ctx, permission: Permission): void {
  allow(ctx, permission);
}

/**
 * Which records this person may see, as SQL on the column holding who made them ("owner" or
 * "emp-<id>"): everything for the owner, only their own for an employee, nothing for nobody.
 * Used inside every query of sales and receipts, so no screen can show more.
 */
export function visibleTo(ctx: Ctx, column: string): { sql: string; params: string[] } {
  const actor = ctx.actor;
  if (!actor) return { sql: '0', params: [] };
  if (can(actor, 'sales.viewAll')) return { sql: '1', params: [] };
  return { sql: `${column} = ?`, params: [actorKey(actor)] };
}

/**
 * Who is doing this action, for the record: ("owner" or "emp-<id>", their name). Called inside
 * actions that already passed `allow`, so someone is signed in; refuses otherwise.
 */
export function who(ctx: Ctx): [key: string, name: string] {
  const actor = ctx.actor;
  if (!actor) throw new PermissionError('سجّل الدخول أولاً.');
  return [actorKey(actor), actorName(actor)];
}

/** A refusal because the device clock went back. Nothing was changed. */
export class ClockError extends RuleError {
  constructor(message: string) {
    super(message);
    this.name = 'ClockError';
  }
}

/** A refusal because of who is signed in. Nothing was changed. */
export class PermissionError extends RuleError {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

/** Trims text; empty becomes null (stored as NULL, not ''). */
export function clean(text: string | null | undefined): string | null {
  const t = (text ?? '').trim();
  return t === '' ? null : t;
}

/** A page of a long list: the first `limit` rows after `offset`. */
export type Page = { limit: number; offset?: number };

/** LIMIT/OFFSET for a page (whole numbers only, so nothing else can reach the SQL). */
export const pageSql = (page?: Page) =>
  page
    ? ` LIMIT ${Math.max(0, Math.floor(page.limit))} OFFSET ${Math.max(0, Math.floor(page.offset ?? 0))}`
    : '';
