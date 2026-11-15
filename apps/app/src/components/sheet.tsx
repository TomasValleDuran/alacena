import { router } from 'expo-router'
import type { ReactNode } from 'react'

/**
 * Wraps the content of a sheet route (settings, pantry-options, manual-entry,
 * new-product). Natively the route already is a formSheet, so this is a
 * passthrough. Web: `sheet.web.tsx` draws a modal dialog over the tabs.
 * `title` names the dialog for assistive tech and the browser tab on web.
 */
export function Sheet({ children }: { title: string; children: ReactNode }) {
  return <>{children}</>
}

/** Close the current sheet. Web falls back to "/" when nothing is behind it. */
export function closeSheet() {
  router.back()
}
