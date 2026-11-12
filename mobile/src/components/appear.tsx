import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  ZoomIn,
} from 'react-native-reanimated';

/**
 * A short, quiet entrance (and exit) for something that just changed: a line added to the cart, the
 * sold tick. Items around it slide into place instead of jumping. With "Reduce Motion" on, iOS's
 * own setting, everything simply appears.
 */
export function Appear({
  children,
  kind = 'fade',
  style,
}: {
  children: ReactNode;
  /** fade: lines and cards; pop: a confirmation mark. */
  kind?: 'fade' | 'pop';
  style?: StyleProp<ViewStyle>;
}) {
  const entering =
    kind === 'pop'
      ? ZoomIn.springify().damping(14).reduceMotion(ReduceMotion.System)
      : FadeIn.duration(220).reduceMotion(ReduceMotion.System);
  return (
    <Animated.View
      style={style}
      entering={entering}
      exiting={FadeOut.duration(160).reduceMotion(ReduceMotion.System)}
      layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)}>
      {children}
    </Animated.View>
  );
}
