import { useEffect } from 'react';
import { AppState } from 'react-native';

import { lastLine, recordLogBroken, recordStaff, walkLog, type LogCheck } from '@/domain/activity';
import type { Ctx } from '@/domain/context';
import { logError } from '@/lib/error-log';
import type { SystemId } from '@/theme';

import {
  readAnchor,
  readVerified,
  reportedBreaks,
  saveAnchor,
  saveReported,
  saveVerified,
  setOpenLog,
  showBreaks,
  takeWaiting,
} from './guards';

/**
 * Runs with each open system (phase S3):
 * - writes the sign-ins and wrong PINs that happened before the database opened;
 * - checks the activity log once the screens are up, against the last line remembered outside
 *   the database: the lines added since the last check, and the whole chain once a week; a break
 *   is written to the log once and shown to the owner;
 * - remembers the newest line when the app goes to the background.
 */
export function LogGuard({ ctx }: { ctx: Ctx }) {
  useEffect(() => {
    for (const write of takeWaiting<Ctx>(ctx.system)) {
      try {
        write(ctx);
      } catch (error) {
        logError('سجل النشاط', error);
      }
    }
    setOpenLog({
      system: ctx.system,
      write: (summary, details) => {
        try {
          ctx.db.transaction(() => recordStaff(ctx, summary, details));
        } catch (error) {
          logError('سجل النشاط', error);
        }
      },
    });
    // After the first screen is drawn, a page at a time with a pause between pages: a long log
    // (years of use) never holds the screen.
    let stopped = false;
    const walk = startWalk(ctx);
    const step = () => {
      if (stopped) return;
      try {
        const next = walk.next();
        if (next.done) reportLog(ctx, next.value);
        else timer = setTimeout(step, 16);
      } catch (error) {
        logError('فحص سجل النشاط', error);
      }
    };
    let timer = setTimeout(step, 400);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        try {
          saveAnchor(ctx.system, lastLine(ctx));
        } catch (error) {
          logError('سجل النشاط', error);
        }
      }
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      sub.remove();
      setOpenLog(null);
    };
  }, [ctx]);
  return null;
}

/** The whole chain is walked again at least this often, even with nothing new. */
export const FULL_CHECK_MS = 7 * 24 * 60 * 60_000;

/** Where the check starts: after the last line found unchanged, unless a full walk is due. */
function startFrom(system: SystemId, now = Date.now()) {
  const v = readVerified(system);
  if (!v) return null;
  const at = Date.parse(v.fullAt);
  return Number.isFinite(at) && now - at < FULL_CHECK_MS && now >= at ? v : null;
}

function startWalk(ctx: Ctx, now?: number) {
  return walkLog(ctx, readAnchor(ctx.system), 500, startFrom(ctx.system, now));
}

/** The whole check at once (tests; `now` decides whether a full walk is due). */
export function checkLog(ctx: Ctx, now?: number) {
  try {
    const walk = startWalk(ctx, now);
    for (;;) {
      const next = walk.next();
      if (next.done) return reportLog(ctx, next.value);
    }
  } catch (error) {
    logError('فحص سجل النشاط', error);
  }
}

/** A break is written to the log once, shown to the owner, and the newest line remembered. */
function reportLog(ctx: Ctx, result: LogCheck) {
  try {
    const reported = new Set(reportedBreaks(ctx.system));
    const fresh = result.broken.filter((id) => !reported.has(id));
    if (fresh.length) {
      recordLogBroken(ctx, fresh[0]);
      saveReported(ctx.system, [...reported, ...fresh]);
    }
    // A break keeps the next checks walking the whole chain, so it is never lost from view.
    if (result.broken.length === 0) {
      showBreaks(ctx.system, []);
      saveVerified(ctx.system, {
        ...result.last,
        fullAt: result.full
          ? new Date().toISOString()
          : (readVerified(ctx.system)?.fullAt ?? new Date().toISOString()),
      });
    } else {
      showBreaks(ctx.system, result.broken);
      saveVerified(ctx.system, { id: 0, hash: '', fullAt: '' });
    }
    saveAnchor(ctx.system, lastLine(ctx));
  } catch (error) {
    logError('فحص سجل النشاط', error);
  }
}
