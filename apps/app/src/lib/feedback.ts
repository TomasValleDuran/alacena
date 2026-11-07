import * as Haptics from 'expo-haptics'

/**
 * Scanning is eyes-on-the-product work: the phone has to say "got it" through
 * the hand. Each outcome has a distinct pattern so it can be told apart blind.
 */
export const feedback = {
  /** product found and stock changed */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(noop),
  /** needs attention: unknown product, now out of stock */
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(noop),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(noop),
  /** code detected (fires before the lookup returns) */
  detect: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(noop),
  /** steppers, toggles */
  tick: () => Haptics.selectionAsync().catch(noop),
}

function noop() {}
