import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { AnimatedSplash } from '@/components/animated-splash'
import { palette } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

/**
 * The web stack has no form sheet: it shows only the focused screen unless the
 * next one is a transparent modal. So on web the sheets are transparent modals
 * that draw their own dialog (components/sheet.web.tsx) over the tabs, and a
 * cold load of a sheet URL (e.g. /settings) gets the tabs underneath.
 */
const WEB = process.env.EXPO_OS === 'web'

export const unstable_settings = WEB ? { anchor: '(tabs)' } : {}

export default function RootLayout() {
  const { dark } = useTheme()
  const p = dark ? palette.dark : palette.light
  const base = dark ? DarkTheme : DefaultTheme
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: p.accent,
      background: p.bg,
      card: p.bg,
      text: p.text,
      border: p.separator,
    },
  }

  // Native: one detent sized to the content. With two detents, Android's sheet
  // jumps to full height when the keyboard opens and stays there after it
  // closes (react-native-screens SheetDelegate), leaving a big empty area.
  const sheet = WEB
    ? ({ presentation: 'transparentModal', headerShown: false, contentStyle: { backgroundColor: 'transparent' } } as const)
    : ({
        presentation: 'formSheet',
        sheetAllowedDetents: 'fitToContents',
        sheetGrabberVisible: true,
        sheetCornerRadius: 20,
        headerShown: false,
        contentStyle: { backgroundColor: p.surface },
      } as const)

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="auto" />
        <AnimatedSplash>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="new-product" options={sheet} />
            <Stack.Screen name="manual-entry" options={sheet} />
            <Stack.Screen name="settings" options={sheet} />
            <Stack.Screen name="pantry-options" options={sheet} />
          </Stack>
        </AnimatedSplash>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
