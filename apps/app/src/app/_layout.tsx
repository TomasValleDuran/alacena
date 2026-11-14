import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { AnimatedSplash } from '@/components/animated-splash'
import { palette } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

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

  // One detent sized to the content. With two detents, Android's sheet jumps to
  // full height when the keyboard opens and stays there after it closes
  // (react-native-screens SheetDelegate), leaving a big empty area.
  const sheet = {
    presentation: 'formSheet',
    sheetAllowedDetents: 'fitToContents',
    sheetGrabberVisible: true,
    sheetCornerRadius: 20,
    headerShown: false,
    contentStyle: { backgroundColor: p.surface },
  } as const

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
