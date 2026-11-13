import { useEffect } from 'react';
import { AppState } from 'react-native';

import { lastLine, recordLogBroken, recordStaff, walkLog, type LogCheck } from '@/domain/activity';
import type { Ctx } from '@/domain/context';
import { logError } from '@/lib/error-log';

import {
  readAnchor,
  reportedBreaks,
  saveAnchor,
  saveReported,
  setOpenLog,
  showBreaks,
  takeWaiting,
} from './guards';

/**
 * Runs with each open system (phase S3):
 * - writes the sign-ins and wrong PINs that happened before the database opened;
 * - checks the whole activity log once the screens are up, against the last line remembered
 *   outside the database; a break is written to the log once and shown to the owner;
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
    const walk = walkLog(ctx, readAnchor(ctx.system));
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

/** The whole check at once (tests). */
export function checkLog(ctx: Ctx) {
  try {
    const walk = walkLog(ctx, readAnchor(ctx.system));
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
    showBreaks(ctx.system, result.broken);
    saveAnchor(ctx.system, lastLine(ctx));
  } catch (error) {
    logError('فحص سجل النشاط', error);
  }
}
