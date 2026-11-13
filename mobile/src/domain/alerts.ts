/**
 * The owner's alerts (phase S6), shown in "يحتاج انتباهك" on the home screen. Each is read from
 * what the app already records (sales, returns, shifts, the activity log), over the last days
 * set in the rules (`alertDays`), with the limits the owner sets there:
 *
 * - one person gave many discounted sales in a day (`alertDiscounts`);
 * - one person asked for many owner approvals in a day (`alertApprovals`);
 * - a return taken minutes after its sale (`alertReturnMinutes`);
 * - repeated wrong PINs by one person in a day (`alertWrongPins`);
 * - a shift closed short (`alertShortage`);
 * - the device clock went back; the activity log was changed outside the app.
 *
 * The owner's own discounts, approvals and returns raise no alert. An alert the owner has seen
 * ("اطلعت") is hidden; the activity log keeps who saw it and when.
 */
import { dayKey } from '@/lib/dates';
import { formatLyd } from '@/lib/money';

import { logAction } from './activity';
import { allow, allowView, type Ctx } from './context';
import { getPolicies } from './policies';
import { getSetting, setSetting } from './settings';

export type AlertKind =
  'discounts' | 'approvals' | 'quickReturn' | 'wrongPins' | 'shortage' | 'clock' | 'log';

/** Where an alert leads: the shift's report, the return, or the activity log. */
export type AlertTarget = { screen: 'shift' | 'return'; id: number } | { screen: 'log' };

export type OwnerAlert = {
  /** Stable for the same event, so "seen" stays seen. */
  key: string;
  kind: AlertKind;
  title: string;
  detail: string;
  /** The day (YYYY-MM-DD) or moment it happened, for sorting. */
  at: string;
  target: AlertTarget;
};

const SEEN = 'alerts_seen';
/** The most "seen" keys kept (older ones are past the alert window anyway). */
const KEEP_SEEN = 400;

function seenKeys(ctx: Ctx): string[] {
  try {
    const v = JSON.parse(getSetting(ctx, SEEN) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

/** The first day the alerts look at (today counts as day 1). */
function sinceDay(ctx: Ctx, days: number): string {
  const now = ctx.now();
  return dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));
}

const minutes = (m: number) => (m < 1 ? 'أقل من دقيقة' : `${Math.round(m)} دقيقة`);

/** Every alert in the window, newest first, the ones already seen included. */
export function allAlerts(ctx: Ctx): OwnerAlert[] {
  allowView(ctx, 'alerts.manage');
  const p = getPolicies(ctx);
  const since = sinceDay(ctx, p.alertDays);
  const out: OwnerAlert[] = [];

  if (p.alertDiscounts > 0)
    for (const r of ctx.db.all<{ seller: string; name: string; day: string; n: number; d: number }>(
      `SELECT seller, max(seller_name) name, substr(created_at, 1, 10) day, count(*) n, sum(discount) d
         FROM sales WHERE discount > 0 AND created_at >= ? AND seller IS NOT NULL AND seller <> 'owner'
        GROUP BY seller, day HAVING n >= ?`,
      [since, p.alertDiscounts],
    ))
      out.push({
        key: `discounts:${r.seller}:${r.day}`,
        kind: 'discounts',
        title: `${r.name}: ${r.n} مبيعات بخصم في يوم`,
        detail: `يوم ${r.day}، مجموع الخصم ${formatLyd(r.d)}`,
        at: r.day,
        target: { screen: 'log' },
      });

  if (p.alertApprovals > 0)
    for (const r of ctx.db.all<{ person: string; name: string; day: string; n: number }>(
      `SELECT person, max(name) name, day, count(*) n FROM (
         SELECT seller person, seller_name name, substr(created_at, 1, 10) day FROM sales
          WHERE approved_by IS NOT NULL AND created_at >= ?
         UNION ALL
         SELECT by person, by_name name, substr(created_at, 1, 10) day FROM returns
          WHERE approved_by IS NOT NULL AND created_at >= ?
       ) WHERE person IS NOT NULL AND person <> 'owner'
       GROUP BY person, day HAVING n >= ?`,
      [since, since, p.alertApprovals],
    ))
      out.push({
        key: `approvals:${r.person}:${r.day}`,
        kind: 'approvals',
        title: `${r.name}: ${r.n} موافقات منك في يوم`,
        detail: `يوم ${r.day}: خصومات أو مرتجعات خارج القواعد وافقت عليها`,
        at: r.day,
        target: { screen: 'log' },
      });

  if (p.alertReturnMinutes > 0)
    for (const r of ctx.db.all<{
      id: number;
      name: string;
      by_name: string | null;
      created_at: string;
      sale_id: number;
      gap: number;
      refund: number;
    }>(
      `SELECT r.id, r.name, r.by_name, r.created_at, s.id sale_id, r.refund,
              (julianday(r.created_at) - julianday(s.created_at)) * 1440 gap
         FROM returns r JOIN sale_lines l ON l.id = r.sale_line_id JOIN sales s ON s.id = l.sale_id
        WHERE r.created_at >= ? AND coalesce(r.by, '') <> 'owner'
          AND (julianday(r.created_at) - julianday(s.created_at)) * 1440 <= ?`,
      [since, p.alertReturnMinutes],
    ))
      out.push({
        key: `quickReturn:${r.id}`,
        kind: 'quickReturn',
        title: `مرتجع بعد ${minutes(r.gap)} من البيع`,
        detail: `${r.name} من البيعة رقم ${r.sale_id}، أرجعه ${r.by_name ?? 'موظف'} بـ ${formatLyd(r.refund)}`,
        at: r.created_at,
        target: { screen: 'return', id: r.id },
      });

  if (p.alertWrongPins > 0)
    for (const r of ctx.db.all<{ actor: string; name: string; day: string; n: number }>(
      `SELECT actor, max(actor_name) name, day, count(*) n FROM activity
        WHERE action IN ('pin.wrong', 'pin.locked') AND day >= ?
        GROUP BY actor, day HAVING n >= ?`,
      [since, p.alertWrongPins],
    ))
      out.push({
        key: `wrongPins:${r.actor}:${r.day}`,
        kind: 'wrongPins',
        title: `${r.n} محاولات رمز خطأ: ${r.name}`,
        detail: `يوم ${r.day}`,
        at: r.day,
        target: { screen: 'log' },
      });

  for (const r of ctx.db.all<{ id: number; name: string; closed_at: string; short: number }>(
    `SELECT id, person_name name, closed_at, expected_cash - counted_cash short FROM shifts
      WHERE closed_at IS NOT NULL AND closed_at >= ? AND expected_cash - counted_cash >= ?`,
    [since, Math.max(1, p.alertShortage)],
  ))
    out.push({
      key: `shortage:${r.id}`,
      kind: 'shortage',
      title: `عجز ${formatLyd(r.short)} في وردية ${r.name}`,
      detail: `الوردية رقم ${r.id}`,
      at: r.closed_at,
      target: { screen: 'shift', id: r.id },
    });

  for (const r of ctx.db.all<{ id: number; action: string; summary: string; at: string }>(
    `SELECT id, action, summary, at FROM activity
      WHERE action IN ('clock.back', 'log.broken') AND day >= ?`,
    [since],
  ))
    out.push({
      key: `${r.action}:${r.id}`,
      kind: r.action === 'clock.back' ? 'clock' : 'log',
      title: r.action === 'clock.back' ? 'ساعة الجهاز رجعت للخلف' : 'السجل تغيّر خارج التطبيق',
      detail: r.summary,
      at: r.at,
      target: { screen: 'log' },
    });

  return out.sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key));
}

/** The alerts the owner has not seen yet: what "يحتاج انتباهك" shows. */
export function ownerAlerts(ctx: Ctx): OwnerAlert[] {
  const seen = new Set(seenKeys(ctx));
  return allAlerts(ctx).filter((a) => !seen.has(a.key));
}

/** The owner has seen an alert: it is hidden, and the log says so. */
export function acknowledgeAlert(ctx: Ctx, alert: Pick<OwnerAlert, 'key' | 'title'>): void {
  allow(ctx, 'alerts.manage');
  ctx.db.transaction(() => {
    const seen = seenKeys(ctx).filter((k) => k !== alert.key);
    seen.push(alert.key);
    setSetting(ctx, SEEN, JSON.stringify(seen.slice(-KEEP_SEEN)));
    logAction(ctx, 'alert.seen', `اطلع على تنبيه: ${alert.title}`, { key: alert.key });
  });
}
