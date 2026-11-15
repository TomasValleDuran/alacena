import { View } from 'react-native'

import { radius, space } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

/**
 * Rounded surface card. Plain by default (a section on a screen: roomy
 * padding, children laid out by the caller). `elevated` floats over a busy
 * backdrop such as the camera preview: tighter padding, children stacked with
 * a small gap, and a drop shadow to lift it off the background.
 */
export function Card({ children, elevated }: { children: React.ReactNode; elevated?: boolean }) {
  const { c } = useTheme()
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        ...(elevated
          ? { padding: space.md, gap: space.sm, boxShadow: '0 6px 24px rgba(0,0,0,0.25)' }
          : { padding: space.lg }),
      }}
    >
      {children}
    </View>
  )
}
