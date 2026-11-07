import { create } from 'zustand'

import { api, errorMessage } from '@/lib/api'
import type { Product, StockRow } from '@/lib/types'

type Status = 'idle' | 'loading' | 'ready' | 'error'

type StockState = {
  items: StockRow[]
  status: Status
  error: string | null
  refreshing: boolean

  fetch: (opts?: { silent?: boolean }) => Promise<void>
  /** Stepper +/−: optimistic, reconciled with the server's total. */
  adjust: (row: StockRow, delta: number) => Promise<void>
  /** Scanner path: add/subtract by product, creating the row if needed. Returns the new total. */
  adjustProduct: (product: Product, delta: number) => Promise<number>
  setMinQty: (row: StockRow, minQty: number) => Promise<void>
  remove: (row: StockRow) => Promise<void>
}

// in-flight stepper requests per row: only the last reply may overwrite the
// optimistic value, so fast taps never "bounce back"
const inflight = new Map<string, number>()

export const useStock = create<StockState>((set, get) => {
  function patchRow(id: string, patch: Partial<StockRow>) {
    set({ items: get().items.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  }

  return {
    items: [],
    status: 'idle',
    error: null,
    refreshing: false,

    async fetch(opts) {
      const first = get().status !== 'ready'
      if (opts?.silent && first) return
      set(first ? { status: 'loading', error: null } : { refreshing: !opts?.silent })
      try {
        const items = await api.getStock()
        set({ items, status: 'ready', error: null })
      } catch (e) {
        // keep showing the last good data on a failed refresh
        if (first) set({ status: 'error', error: errorMessage(e) })
        else if (!opts?.silent) set({ error: errorMessage(e) })
      } finally {
        set({ refreshing: false })
      }
    },

    async adjust(row, delta) {
      const current = get().items.find((r) => r.id === row.id)
      if (!current) return
      const optimistic = Math.max(0, current.quantity + delta)
      if (optimistic === current.quantity) return
      patchRow(row.id, { quantity: optimistic, updatedAt: new Date().toISOString() })

      inflight.set(row.id, (inflight.get(row.id) ?? 0) + 1)
      try {
        const total = await api.addStock(row.productId, optimistic - current.quantity)
        if (inflight.get(row.id) === 1) patchRow(row.id, { quantity: total })
      } catch (e) {
        if (inflight.get(row.id) === 1) await get().fetch({ silent: true })
        throw e
      } finally {
        inflight.set(row.id, (inflight.get(row.id) ?? 1) - 1)
      }
    },

    async adjustProduct(product, delta) {
      const total = await api.addStock(product.id, delta)
      const existing = get().items.find((r) => r.productId === product.id)
      if (existing) {
        patchRow(existing.id, { quantity: total, updatedAt: new Date().toISOString() })
      } else {
        // first time this product enters the pantry — need the new row's id
        await get().fetch({ silent: true })
      }
      return total
    },

    async setMinQty(row, minQty) {
      const prev = row.minQty
      patchRow(row.id, { minQty })
      try {
        await api.patchStock(row.id, { minQty })
      } catch (e) {
        patchRow(row.id, { minQty: prev })
        throw e
      }
    },

    async remove(row) {
      const before = get().items
      set({ items: before.filter((r) => r.id !== row.id) })
      try {
        await api.deleteStock(row.id)
      } catch (e) {
        set({ items: before })
        throw e
      }
    },
  }
})
