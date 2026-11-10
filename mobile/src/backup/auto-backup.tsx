import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { Ctx } from '@/domain/context';

import { saveBackup } from './store';

/**
 * Saves a backup of the open system every time the app goes to the background (it is skipped
 * when nothing changed). Written at once, before iOS suspends the app.
 */
export function AutoBackup({ ctx }: { ctx: Ctx }) {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'background') return;
      try {
        saveBackup(ctx, 'auto');
      } catch {
        // A failed automatic backup must never stop the app; the next one tries again.
      }
    });
    return () => sub.remove();
  }, [ctx]);
  return null;
}
