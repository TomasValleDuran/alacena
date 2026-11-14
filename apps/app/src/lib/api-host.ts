import Constants from 'expo-constants'

/**
 * Where the backend probably is when nothing is configured. On a real phone
 * "localhost" is the phone itself, so in development we guess the Metro host's
 * LAN IP on :3001 — that's what makes `expo start` + the API's `npm run dev`
 * work with zero setup. Web: `api-host.web.ts`.
 */
export function guessApiUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0]
  if (host) return `http://${host}:3001`
  return 'http://localhost:3001'
}
