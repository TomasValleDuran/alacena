import { router } from 'expo-router'

/** Go back, or to the pantry when there is no history (a reload or shared link on web). */
export function goBack() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}
