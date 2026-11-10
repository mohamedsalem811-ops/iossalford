import { useWindowDimensions } from 'react-native';

export type LayoutClass = 'compact' | 'regular' | 'wide';

/** Width breakpoints: iPhone and narrow iPad split view, iPad portrait, iPad landscape. */
export function layoutClass(width: number): LayoutClass {
  if (width >= 1000) return 'wide';
  if (width >= 700) return 'regular';
  return 'compact';
}

/** Grid columns for product tiles at a given width (minimum tile width ~160 pt). */
export function gridColumns(width: number, minTile = 160, gap = 12, padding = 16): number {
  const usable = width - padding * 2;
  return Math.max(2, Math.min(6, Math.floor((usable + gap) / (minTile + gap))));
}

/**
 * Layout facts for the current window. On iPad it follows Split View and Stage Manager sizes,
 * not just the device: a narrow split window lays out like an iPhone.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const cls = layoutClass(width);
  return {
    width,
    height,
    layoutClass: cls,
    /** Show a list and its detail side by side. */
    split: cls !== 'compact',
    /** The sale screen keeps the cart open beside the products (iPad, as in the plan). */
    cartBeside: cls !== 'compact',
    columns: (minTile?: number) => gridColumns(width, minTile),
    /** Dashboard cards per row. */
    dashboardColumns: cls === 'wide' ? 3 : cls === 'regular' ? 2 : 1,
  };
}
