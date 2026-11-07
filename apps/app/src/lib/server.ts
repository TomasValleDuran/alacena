import Storage from 'expo-sqlite/kv-store'
import Constants from 'expo-constants'

const KEY = 'alacena.apiUrl'

/**
 * Where the backend lives. Order: saved in Ajustes → EXPO_PUBLIC_API_URL →
 * (dev) the Metro host's LAN IP on :3001 → localhost. On a real phone
 * "localhost" is the phone itself, so the LAN guess is what makes
 * `expo start` + `npm run dev` in back-alacena work with zero setup.
 */
export function defaultApiUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL
  if (env) return trimSlash(env)
  const host = Constants.expoConfig?.hostUri?.split(':')[0]
  if (host) return `http://${host}:3001`
  return 'http://localhost:3001'
}

export function loadApiUrl(): string {
  try {
    return Storage.getItemSync(KEY) ?? defaultApiUrl()
  } catch {
    return defaultApiUrl()
  }
}

export function saveApiUrl(url: string | null) {
  try {
    if (url) Storage.setItemSync(KEY, trimSlash(url))
    else Storage.removeItemSync(KEY)
  } catch {
    // storage unavailable — the value still applies for this session
  }
}

export function trimSlash(url: string): string {
  return url.trim().replace(/\/+$/, '')
}
