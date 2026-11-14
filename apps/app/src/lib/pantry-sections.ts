import { aisleLabel, aisleOf, aisleOrder, type AisleKey } from './aisles'
import { fold } from './text'
import { stockLevel, type StockLevel, type StockRow } from './types'
import type { GroupBy, PantryFilter, SortBy } from '@/store/pantry-view'

export type PantrySection = {
  key: string
  title: string
  /** all rows in the section (before collapsing) */
  rows: StockRow[]
  /** how many of them need restocking (low or out) */
  restock: number
}

const collator = new Intl.Collator('es', { sensitivity: 'base' })

const LEVEL_ORDER: Record<StockLevel, number> = { out: 0, low: 1, ok: 2 }
const LEVEL_TITLE: Record<StockLevel, string> = { out: 'Agotado', low: 'Por reponer', ok: 'Con stock' }

export function matchesFilter(r: StockRow, filter: PantryFilter, listed: Set<string>): boolean {
  const level = stockLevel(r.quantity, r.minQty)
  switch (filter) {
    case 'restock':
      return level !== 'ok'
    case 'out':
      return level === 'out'
    case 'inStock':
      return r.quantity > 0
    case 'onList':
      return listed.has(r.productId)
    default:
      return true
  }
}

function sorter(sortBy: SortBy) {
  return (a: StockRow, b: StockRow) => {
    if (sortBy === 'qty') return a.quantity - b.quantity || collator.compare(a.product.name, b.product.name)
    if (sortBy === 'recent') return b.updatedAt.localeCompare(a.updatedAt)
    return collator.compare(a.product.name, b.product.name)
  }
}

/** Filtered, searched, grouped and sorted pantry. Empty sections are dropped. */
export function buildSections(
  items: StockRow[],
  opts: { filter: PantryFilter; query: string; groupBy: GroupBy; sortBy: SortBy; listed: Set<string> },
): PantrySection[] {
  const q = fold(opts.query.trim())
  const rows = items.filter(
    (r) =>
      matchesFilter(r, opts.filter, opts.listed) &&
      (!q || fold(`${r.product.name} ${r.product.brand ?? ''}`).includes(q)),
  )

  const groups = new Map<string, { title: string; order: number; rows: StockRow[] }>()
  for (const r of rows) {
    let key: string
    let title: string
    let order: number
    if (opts.groupBy === 'aisle') {
      const a: AisleKey = aisleOf(r.product)
      key = `aisle:${a}`
      title = aisleLabel(a)
      order = aisleOrder(a)
    } else if (opts.groupBy === 'status') {
      const l = stockLevel(r.quantity, r.minQty)
      key = `status:${l}`
      title = LEVEL_TITLE[l]
      order = LEVEL_ORDER[l]
    } else {
      key = 'all'
      title = 'Todo'
      order = 0
    }
    const g = groups.get(key) ?? { title, order, rows: [] }
    g.rows.push(r)
    groups.set(key, g)
  }

  const sort = sorter(opts.sortBy)
  return [...groups.entries()]
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, g]) => ({
      key,
      title: g.title,
      rows: g.rows.sort(sort),
      restock: g.rows.filter((r) => stockLevel(r.quantity, r.minQty) !== 'ok').length,
    }))
}
