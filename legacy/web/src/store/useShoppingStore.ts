import { create } from 'zustand'
import type { ShoppingItem } from '@/types/shopping'
import { api, type ShoppingRow } from '@/lib/api'

function normalize(row: ShoppingRow): ShoppingItem {
  return {
    id: row.id,
    productId: row.productId,
    name: row.name,
    quantity: Number(row.quantity),
    checked: row.checked,
    createdAt: row.createdAt,
    product: row.product ?? null,
  }
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
    try {
      const rows = await api.getShopping()
      set({ items: rows.map(normalize), loaded: true, error: null })
    } catch (e) {
      set({ loaded: true, error: e instanceof Error ? e.message : 'No se pudo cargar la lista' })
    }
  },

  addManual: async (name: string, quantity: number) => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      await api.addManualShopping(trimmed, Math.max(1, quantity))
      await get().fetchList()
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'No se pudo agregar' })
    }
  },

  generateFromLowStock: async () => {
    try {
      const added = await api.generateShopping()
      if (added > 0) await get().fetchList()
      return added
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'No se pudo generar la lista' })
      return 0
    }
  },

  setQuantity: async (id: string, quantity: number) => {
    const next = Math.max(1, Math.round(quantity))
    const current = get().items.find((i) => i.id === id)
    if (!current || current.quantity === next) return

    // optimistic so the stepper feels instant
    set({ items: get().items.map((i) => (i.id === id ? { ...i, quantity: next } : i)) })

    try {
      await api.patchShopping(id, { quantity: next })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'No se pudo actualizar' })
      await get().fetchList()
    }
  },

  toggleChecked: async (id: string) => {
    const current = get().items.find((i) => i.id === id)
    if (!current) return
    const next = !current.checked

    set({ items: get().items.map((i) => (i.id === id ? { ...i, checked: next } : i)) })

    try {
      await api.patchShopping(id, { checked: next })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'No se pudo actualizar' })
      await get().fetchList()
    }
  },

  remove: async (id: string) => {
    const prev = get().items
    set({ items: prev.filter((i) => i.id !== id) })
    try {
      await api.deleteShopping(id)
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'No se pudo eliminar', items: prev })
    }
  },

  clearChecked: async () => {
    const prev = get().items
    set({ items: prev.filter((i) => !i.checked) })
    try {
      await api.clearCheckedShopping()
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'No se pudo limpiar' })
      await get().fetchList()
    }
  },
}))
