import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useOnDataChanged } from '@/state/data-events';

/** Rows read per page: a screen and a half on an iPad, so scrolling never waits. */
export const PAGE_SIZE = 60;

/**
 * A long list read as you scroll: the first page, then one more page each time the end comes
 * into view. Coming back to the screen or a change to the data reads again what is shown (never
 * the whole table). `load` must change when the filter changes; that starts again at one page.
 */
export function usePaged<T>(load: (limit: number, offset: number) => T[], pageSize = PAGE_SIZE) {
  const [count, setCount] = useState(pageSize);
  const [items, setItems] = useState<T[]>(() => load(pageSize, 0));

  // A new filter: back to the first page (not on the first render, already read above).
  const lastLoad = useRef(load);
  useEffect(() => {
    if (lastLoad.current === load) return;
    lastLoad.current = load;
    setCount(pageSize);
    setItems(load(pageSize, 0));
  }, [load, pageSize]);

  const refresh = useCallback(() => setItems(load(count, 0)), [load, count]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);

  /** For FlashList's onEndReached: reads the next page if the last one was full. */
  const loadMore = useCallback(() => {
    if (items.length < count) return;
    const next = load(pageSize, count);
    if (next.length === 0) return;
    setItems((shown) => [...shown, ...next]);
    setCount((c) => c + pageSize);
  }, [items.length, count, load, pageSize]);

  return { items, loadMore, refresh };
}
