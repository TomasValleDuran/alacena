import { create } from 'zustand'
import type { Product } from '@/types/product'
import type { ShoppingItem } from '@/types/shopping'
import { supabase } from '@/lib/supabase'
import { useStockStore } from '@/store/useStockStore'

type ShoppingRow = {
  id: string
  product_id: string | null
  name: string | null
  quantity: string | number
  checked: boolean
  created_at: string
  product: Product | null
}

function normalize(row: ShoppingRow): ShoppingItem {
  return {
    id: row.id,
    product_id: row.product_id,
    name: row.name,
    quantity: Number(row.quantity),
    checked: row.checked,
    created_at: row.created_at,
    product: row.product ?? null,
  }
}

/** Items at or below their reorder threshold (or out of stock). */
function isLow(quantity: number, minQty: number | null): boolean {
  return quantity <= 0 || (minQty != null && minQty > 0 && quantity <= minQty)
}

type ShoppingState = {
  items: ShoppingItem[]
  loaded: boolean
  error: string | null
  fetchList: () => Promise<void>
  /** Free-text item not tied to a catalog product. */
  addManual: (name: string, quantity: number) => Promise<void>
  /** Add every low-stock product not already on the list. Returns how many were added. */
  generateFromLowStock: () => Promise<number>
  setQuantity: (id: string, quantity: number) => Promise<void>
  toggleChecked: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  clearChecked: () => Promise<void>
}

export const useShoppingStore = create<ShoppingState>((set, get) => ({
  items: [],
  loaded: false,
  error: null,

  fetchList: async () => {
    const { data, error } = await supabase
      .from('shopping_list')
      .select('id, product_id, name, quantity, checked, created_at, product:products (*)')
      .order('created_at', { ascending: true })

    if (error) {
      set({ loaded: true, error: error.message })
      return
    }
    const rows = (data ?? []) as unknown as ShoppingRow[]
    set({ items: rows.map(normalize), loaded: true, error: null })
  },

  addManual: async (name: string, quantity: number) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const { error } = await supabase.from('shopping_list').insert({
      name: trimmed,
      quantity: Math.max(1, quantity),
      checked: false,
    })
    if (error) {
      set({ error: error.message })
      return
    }
    await get().fetchList()
  },

  generateFromLowStock: async () => {
    // make sure we're reasoning over fresh stock
    const stock = useStockStore.getState()
    if (!stock.loaded) await stock.fetchStock()
    const stockItems = useStockStore.getState().items

    const onList = new Set(
      get()
        .items.map((i) => i.product_id)
        .filter((id): id is string => id != null),
    )

    const rows = stockItems
      .filter((i) => isLow(i.quantity, i.min_qty) && !onList.has(i.product_id))
      .map((i) => ({
        product_id: i.product_id,
        // suggest enough to reach the threshold, at least 1
        quantity:
          i.min_qty != null && i.min_qty > 0 ? Math.max(1, i.min_qty - i.quantity) : 1,
        checked: false,
      }))

    if (rows.length === 0) return 0

    const { error } = await supabase.from('shopping_list').insert(rows)
    if (error) {
      set({ error: error.message })
      return 0
    }
    await get().fetchList()
    return rows.length
  },

  setQuantity: async (id: string, quantity: number) => {
    const next = Math.max(1, Math.round(quantity))
    const current = get().items.find((i) => i.id === id)
    if (!current || current.quantity === next) return

    // optimistic so the stepper feels instant
    set({ items: get().items.map((i) => (i.id === id ? { ...i, quantity: next } : i)) })

    const { error } = await supabase
      .from('shopping_list')
      .update({ quantity: next })
      .eq('id', id)
    if (error) {
      set({ error: error.message })
      await get().fetchList()
    }
  },

  toggleChecked: async (id: string) => {
    const current = get().items.find((i) => i.id === id)
    if (!current) return
    const next = !current.checked

    set({ items: get().items.map((i) => (i.id === id ? { ...i, checked: next } : i)) })

    const { error } = await supabase
      .from('shopping_list')
      .update({ checked: next })
      .eq('id', id)
    if (error) {
      set({ error: error.message })
      await get().fetchList()
    }
  },

  remove: async (id: string) => {
    const prev = get().items
    set({ items: prev.filter((i) => i.id !== id) })
    const { error } = await supabase.from('shopping_list').delete().eq('id', id)
    if (error) {
      set({ error: error.message, items: prev })
    }
  },

  clearChecked: async () => {
    const prev = get().items
    set({ items: prev.filter((i) => !i.checked) })
    const { error } = await supabase.from('shopping_list').delete().eq('checked', true)
    if (error) {
      set({ error: error.message })
      await get().fetchList()
    }
  },
}))
