import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { spacing } from '@/theme';

/** Side margin that centres content `maxWidth` wide in a view `width` wide (at least the 16 pt edge). */
export function readableSide(width: number, maxWidth: number, edge: number = spacing.md): number {
  return Math.max(edge, Math.round((width - maxWidth) / 2));
}

/**
 * Keeps a scroll view's content at a readable width, centred, on a wide iPad. It measures the
 * scroll view and pads both sides equally: centring with alignSelf is ignored on a scroll
 * view's content in right-to-left, which left the content stuck to the right.
 */
export function useReadable(maxWidth = 760) {
  const [width, setWidth] = useState(0);
  const side = readableSide(width, maxWidth);
  return {
    onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width),
    /** Equal side padding (for lists too: FlashList takes it as paddingHorizontal). */
    side,
    padding: { paddingStart: side, paddingEnd: side },
  };
}
