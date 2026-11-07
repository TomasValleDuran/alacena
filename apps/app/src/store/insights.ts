import { create } from 'zustand'

import { api, errorMessage } from '@/lib/api'
import type { Insights } from '@/lib/types'

import { useStock } from './stock'

type Entry =
  | { status: 'loading' }
  | { status: 'ready'; data: Insights; at: number }
  | { status: 'error'; error: string }

type InsightsState = {
  byProduct: Record<string, Entry>
  /** Fetch prices/categories for a product (deduped; reuses data < 5 min old). */
  load: (productId: string, opts?: { force?: boolean }) => Promise<void>
}

const FRESH_MS = 5 * 60 * 1000

export const useInsights = create<InsightsState>((set, get) => ({
  byProduct: {},

  async load(productId, opts) {
    const cur = get().byProduct[productId]
    if (cur?.status === 'loading') return
    if (!opts?.force && cur?.status === 'ready' && Date.now() - cur.at < FRESH_MS) return

    const put = (e: Entry) => set({ byProduct: { ...get().byProduct, [productId]: e } })
    put({ status: 'loading' })
    try {
      const data = await api.getInsights(productId)
      put({ status: 'ready', data, at: Date.now() })
      // the server may have backfilled categories / blurHash / image: show them everywhere
      useStock.setState({
        items: useStock
          .getState()
          .items.map((r) => (r.productId === productId ? { ...r, product: data.product } : r)),
      })
    } catch (e) {
      put({ status: 'error', error: errorMessage(e) })
    }
  },
}))
