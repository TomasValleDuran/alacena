import { create } from 'zustand'

import { api } from '@/lib/api'
import type { ShoppingRow } from '@/lib/types'

import { fetchInto, type Status } from './resource'
import { useStock } from './stock'

type ShoppingState = {
  items: ShoppingRow[]
  status: Status
  error: string | null
  refreshing: boolean

  fetch: (opts?: { silent?: boolean }) => Promise<void>
  addText: (name: string) => Promise<void>
  addProduct: (productId: string, quantity?: number) => Promise<void>
  addMissing: () => Promise<number>
  toggle: (row: ShoppingRow) => Promise<void>
  setQuantity: (row: ShoppingRow, quantity: number) => Promise<void>
  remove: (row: ShoppingRow) => Promise<void>
  /** After shopping: checked catalog items go into the pantry, then all checked rows clear. */
  putAway: () => Promise<number>
  clearChecked: () => Promise<void>
}

export const useShopping = create<ShoppingState>((set, get) => {
  function patchRow(id: string, patch: Partial<ShoppingRow>) {
    set({ items: get().items.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  }

  return {
    items: [],
    status: 'idle',
    error: null,
    refreshing: false,

    fetch: (opts) => fetchInto(set, get, () => api.getShopping(), opts),

    async addText(name) {
      const row = await api.addShoppingText(name)
      set({ items: [...get().items, row] })
    },

    async addProduct(productId, quantity = 1) {
      let row = await api.addShoppingProduct(productId, quantity)
      // already on the list but ticked as bought: asking for it again means "need it again"
      if (row.checked) row = await api.patchShopping(row.id, { checked: false })
      const exists = get().items.some((r) => r.id === row.id)
      set({ items: exists ? get().items.map((r) => (r.id === row.id ? row : r)) : [...get().items, row] })
    },

    async addMissing() {
      const added = await api.generateShopping()
      if (added > 0) await get().fetch({ silent: true })
      return added
    },

    async toggle(row) {
      patchRow(row.id, { checked: !row.checked })
      try {
        await api.patchShopping(row.id, { checked: !row.checked })
      } catch (e) {
        patchRow(row.id, { checked: row.checked })
        throw e
      }
    },

    async setQuantity(row, quantity) {
      const q = Math.max(1, Math.round(quantity))
      patchRow(row.id, { quantity: q })
      try {
        await api.patchShopping(row.id, { quantity: q })
      } catch (e) {
        patchRow(row.id, { quantity: row.quantity })
        throw e
      }
    },

    async remove(row) {
      const before = get().items
      set({ items: before.filter((r) => r.id !== row.id) })
      try {
        await api.deleteShopping(row.id)
      } catch (e) {
        set({ items: before })
        throw e
      }
    },

    async putAway() {
      const checked = get().items.filter((r) => r.checked)
      const stock = useStock.getState()
      let stored = 0
      // sequential: each add is a transaction on the server; keeps totals exact
      for (const row of checked) {
        if (!row.product) continue
        await stock.adjustProduct(row.product, row.quantity)
        stored += row.quantity
        // drop it from the list as soon as it's stored, so a mid-way failure
        // never double-adds on retry
        await api.deleteShopping(row.id)
        set({ items: get().items.filter((r) => r.id !== row.id) })
      }
      await get().clearChecked()
      return stored
    },

    async clearChecked() {
      const before = get().items
      set({ items: before.filter((r) => !r.checked) })
      try {
        await api.clearCheckedShopping()
      } catch (e) {
        set({ items: before })
        throw e
      }
    },
  }
})
