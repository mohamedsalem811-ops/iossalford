import * as Haptics from 'expo-haptics';

/** Haptics never matter enough to fail anything: a device without them simply stays still. */
const quietly = (run: () => Promise<void>) => {
  try {
    run().catch(() => {});
  } catch {
    // No haptics engine (simulator, tests).
  }
};

/**
 * The app's touch feedback, one meaning each: a choice (tap), something added (light), a long
 * press (medium), done (success), refused (error).
 */
export const haptic = {
  tap: () => quietly(() => Haptics.selectionAsync()),
  light: () => quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => quietly(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => quietly(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
