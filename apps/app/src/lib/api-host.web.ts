/**
 * Web: in development the API runs next to the Expo dev server on :3001 (same
 * host, so it also works from a phone on the LAN). In production the API
 * serves the exported web app itself, so it lives at the page's own origin.
 */
export function guessApiUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3001'
  const { protocol, hostname, origin } = window.location
  return __DEV__ ? `${protocol}//${hostname}:3001` : origin
}
