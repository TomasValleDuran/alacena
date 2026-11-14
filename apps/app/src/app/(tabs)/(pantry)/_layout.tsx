import { Stack } from 'expo-router'

export default function PantryStack() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ title: 'Despensa', headerLargeTitle: true }} />
      <Stack.Screen name="item/[id]" options={{ title: '', headerBackTitle: 'Despensa' }} />
    </Stack>
  )
}
