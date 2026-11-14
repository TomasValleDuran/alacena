import { create } from 'zustand'

import { api } from '@/lib/api'
import type { Product, StockRow } from '@/lib/types'

import { fetchInto, type Status } from './resource'

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
// id of the newest request per row: replies can arrive out of order, and the
// older one must not win just because it landed last
const latest = new Map<string, number>()
let requestSeq = 0

export const useStock = create<StockState>((set, get) => {
  function patchRow(id: string, patch: Partial<StockRow>) {
    set({ items: get().items.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  }

  return {
    items: [],
    status: 'idle',
    error: null,
    refreshing: false,

    fetch: (opts) => fetchInto(set, get, () => api.getStock(), opts),

    async adjust(row, delta) {
      const current = get().items.find((r) => r.id === row.id)
      if (!current) return
      const optimistic = Math.max(0, current.quantity + delta)
      if (optimistic === current.quantity) return
      patchRow(row.id, { quantity: optimistic, updatedAt: new Date().toISOString() })

      const mine = ++requestSeq
      latest.set(row.id, mine)
      inflight.set(row.id, (inflight.get(row.id) ?? 0) + 1)
      try {
        const total = await api.addStock(row.productId, optimistic - current.quantity)
        if (latest.get(row.id) === mine) patchRow(row.id, { quantity: total })
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
