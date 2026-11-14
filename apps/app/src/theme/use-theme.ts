import { useColorScheme } from 'react-native'

import { palette, type Palette } from './tokens'

export function useTheme(): { c: Palette; dark: boolean } {
  const dark = useColorScheme() === 'dark'
  return { c: dark ? palette.dark : palette.light, dark }
}
