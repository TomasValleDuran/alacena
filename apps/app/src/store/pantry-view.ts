import Storage from '@/lib/storage'
import { create } from 'zustand'

/** How the Despensa list is grouped, sorted and filtered. Remembered on this phone. */
export type GroupBy = 'aisle' | 'status' | 'none'
export type SortBy = 'name' | 'qty' | 'recent'
export type PantryFilter = 'all' | 'restock' | 'out' | 'inStock' | 'onList'

type Prefs = { groupBy: GroupBy; sortBy: SortBy; collapsed: string[] }

type PantryViewState = Prefs & {
  filter: PantryFilter
  setGroupBy: (g: GroupBy) => void
  setSortBy: (s: SortBy) => void
  setFilter: (f: PantryFilter) => void
  /** section keys look like "aisle:limpieza" / "status:out" */
  toggleSection: (key: string) => void
  setCollapsed: (keys: string[]) => void
}

const KEY = 'alacena.pantryView'
const DEFAULTS: Prefs = { groupBy: 'aisle', sortBy: 'name', collapsed: [] }

function load(): Prefs {
  try {
    const raw = Storage.getItemSync(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

function save(p: Prefs) {
  try {
    Storage.setItemSync(KEY, JSON.stringify(p))
  } catch {
    // not critical: preferences just won't survive a restart
  }
}

export const usePantryView = create<PantryViewState>((set, get) => {
  const persist = (patch: Partial<Prefs>) => {
    set(patch)
    const { groupBy, sortBy, collapsed } = get()
    save({ groupBy, sortBy, collapsed })
  }
  return {
    ...load(),
    filter: 'all', // filters reset each launch on purpose: a forgotten filter hides stock
    setGroupBy: (groupBy) => persist({ groupBy }),
    setSortBy: (sortBy) => persist({ sortBy }),
    setFilter: (filter) => set({ filter }),
    toggleSection: (key) => {
      const c = get().collapsed
      persist({ collapsed: c.includes(key) ? c.filter((k) => k !== key) : [...c, key] })
    },
    setCollapsed: (collapsed) => persist({ collapsed }),
  }
})

export const GROUP_LABEL: Record<GroupBy, string> = { aisle: 'Pasillo', status: 'Estado', none: 'Sin agrupar' }
export const SORT_LABEL: Record<SortBy, string> = { name: 'A–Z', qty: 'Menos cantidad', recent: 'Recientes' }
