import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * Bottom spacing for content pinned to the bottom of a tab screen.
 *
 * iOS: native tab screens extend under the (translucent) tab bar and the
 * safe-area bottom inset includes it, so it's needed.
 * Android: the Material bottom navigation sits below the screen and already
 * absorbs the system navigation inset; adding `insets.bottom` again left a big
 * empty band above the tab bar.
 */
export function useTabBottomInset(): number {
  const insets = useSafeAreaInsets()
  return process.env.EXPO_OS === 'ios' ? insets.bottom : 0
}
