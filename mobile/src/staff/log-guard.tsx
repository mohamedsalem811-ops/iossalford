import { useEffect } from 'react';
import { AppState } from 'react-native';

import { lastLine, recordLogBroken, recordStaff, verifyLog } from '@/domain/activity';
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
    // After the first screen is drawn: a long log never delays opening the system.
    const timer = setTimeout(() => checkLog(ctx), 400);
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
      clearTimeout(timer);
      sub.remove();
      setOpenLog(null);
    };
  }, [ctx]);
  return null;
}

export function checkLog(ctx: Ctx) {
  try {
    const result = verifyLog(ctx, readAnchor(ctx.system));
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
