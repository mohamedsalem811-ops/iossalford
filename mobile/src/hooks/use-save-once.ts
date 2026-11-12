import { useCallback, useRef } from 'react';

/**
 * Stops a quick second tap from saving twice (a sale, a payment, a product). The save runs once;
 * it may run again only when it refused (it did not return true), or, for a form that stays open
 * (`again`), after a short pause. The guard is synchronous: a second tap arriving before the
 * screen redraws or closes is ignored.
 */
export function useSaveOnce(again = false) {
  const state = useRef<'idle' | 'busy' | 'done'>('idle');
  return useCallback(
    (save: () => boolean | void) => {
      if (state.current !== 'idle') return;
      state.current = 'busy';
      let ok = false;
      try {
        ok = save() === true;
      } finally {
        if (!ok) state.current = 'idle';
        else if (again)
          setTimeout(() => {
            state.current = 'idle';
          }, 800);
        else state.current = 'done';
      }
    },
    [again],
  );
}
