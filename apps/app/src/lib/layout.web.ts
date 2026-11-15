import { useWindowDimensions } from 'react-native'

/** Window width from which the web tab shell swaps the bottom bar for a sidebar. */
export const SIDEBAR_MIN_WIDTH = 900

export function useHasSidebar(): boolean {
  return useWindowDimensions().width >= SIDEBAR_MIN_WIDTH
}
