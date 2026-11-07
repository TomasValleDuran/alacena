import { Stack } from 'expo-router'

export default function ListStack() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="list" options={{ title: 'Lista', headerLargeTitle: true }} />
    </Stack>
  )
}
