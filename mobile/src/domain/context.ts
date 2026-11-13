import type { Db } from '@/db/types';
import { monthKey } from '@/lib/dates';
import type { Actor } from '@/staff/model';
import { can, refusal, type Permission } from '@/staff/permissions';
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
  return actor;
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
