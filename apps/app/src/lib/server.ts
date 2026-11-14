import { guessApiUrl } from './api-host'
import Storage from './storage'

const KEY = 'alacena.apiUrl'

/**
 * Where the backend lives. Order: saved in Ajustes → EXPO_PUBLIC_API_URL →
 * a per-platform guess (`api-host.ts`: the Metro host's LAN IP on :3001 on a
 * phone; the page's own host on web).
 */
export function defaultApiUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL
  if (env) return trimSlash(env)
  return trimSlash(guessApiUrl())
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
