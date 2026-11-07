const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** 7415 → "$ 7.415" */
export function money(n: number): string {
  return ars.format(Math.round(n))
}

/** How stale a market's price is, only when it matters (older than a day). */
export function priceAge(iso: string | null): string | null {
  if (!iso) return null
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (!Number.isFinite(days) || days < 2) return null
  return days < 30 ? `hace ${days} días` : 'hace más de un mes'
}
