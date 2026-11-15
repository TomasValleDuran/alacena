import { Stack } from 'expo-router'

import { IconButton } from '@/components/button'
import { goBack } from '@/lib/nav'

// web: after a reload or a shared link there is no history, so the stack shows
// no back button; this one always works and falls back to the pantry
const webBack =
  process.env.EXPO_OS === 'web'
    ? { headerLeft: () => <IconButton icon="back" label="Volver a la despensa" onPress={goBack} /> }
    : {}

export default function PantryStack() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ title: 'Despensa', headerLargeTitle: true }} />
      <Stack.Screen name="item/[id]" options={{ title: '', headerBackTitle: 'Despensa', ...webBack }} />
    </Stack>
  )
}
