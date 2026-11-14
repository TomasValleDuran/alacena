import { stockLevel, type StockRow } from './types'

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Pantry products matching what's being typed in the list's quick-add field.
 * Every typed word must be the start of some word of the name/brand (so
 * "aceite coc" finds "Aceite Girasol COCINERO", but "ac" doesn't match
 * "Multipack"). Ranked: the name starts with the query first; ties put what
 * needs restocking first, then A–Z.
 */
export function suggestFromPantry(items: StockRow[], query: string, limit = 5): StockRow[] {
  const q = fold(query)
  if (q.length < 2) return []
  const words = q.split(' ')

  const scored: { row: StockRow; score: number }[] = []
  for (const row of items) {
    const name = fold(row.product.name)
    const hay = ` ${name} ${fold(row.product.brand ?? '')}`
    if (!words.every((w) => hay.includes(` ${w}`))) continue

    let score = name.startsWith(q) ? 0 : 1
    if (stockLevel(row.quantity, row.minQty) === 'ok') score += 0.5
    scored.push({ row, score })
  }

  return scored
    .sort((a, b) => a.score - b.score || a.row.product.name.localeCompare(b.row.product.name, 'es'))
    .slice(0, limit)
    .map((s) => s.row)
}

/** Same suggestion the backend's "agregar los que faltan" uses. */
export function suggestedQty(row: StockRow): number {
  const min = row.minQty ?? 0
  return min > 0 ? Math.max(1, min - row.quantity) : 1
}
