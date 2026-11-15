/**
 * Whether the web tab shell shows the sidebar (and so its own "Ajustes").
 * Native never does, tablets included: it keeps the header button.
 * The web side is `layout.web.ts`.
 */
export function useHasSidebar(): boolean {
  return false
}
