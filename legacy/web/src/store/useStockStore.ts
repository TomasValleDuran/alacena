import { create } from 'zustand'
import type { Product } from '@/types/product'
import type { StockItemWithProduct } from '@/types/stock'
import { api, type StockRow } from '@/lib/api'

type StockState = {
  items: StockItemWithProduct[]
  loaded: boolean
  loading: boolean
  error: string | null
  fetchStock: () => Promise<void>
  /** Insert or return existing product by barcode */
  upsertProduct: (insert: { barcode: string; name: string; brand?: string | null }) => Promise<Product>
  /**
   * Add delta to a product's stock, creating the stock row if missing.
   * Negative deltas subtract (floored at 0). Returns the resulting quantity.
   */
  addToStock: (product: Product, delta: number) => Promise<number>
  /** Optimistic +/- on an existing stock item (list steppers) */
  adjustItem: (stockItemId: string, delta: number) => Promise<void>
  setQuantities: (stockItemId: string, quantity: number, minQty: number) => Promise<void>
  deleteItem: (stockItemId: string) => Promise<void>
}

function normalize(row: StockRow): StockItemWithProduct {
  return {
    id: row.id,
    productId: row.productId,
    quantity: Number(row.quantity),
    minQty: row.minQty == null ? null : Number(row.minQty),
    updatedAt: row.updatedAt,
    product: row.product,
  }
}

export const useStockStore = create<StockState>((set, get) => ({
  items: [],
  loaded: false,
  loading: false,
  error: null,

  fetchStock: async () => {
    set({ loading: true, error: null })
    try {
      const rows = await api.getStock()
      set({ items: rows.map(normalize), loading: false, loaded: true, error: null })
    } catch (e) {
      set({
        loading: false,
        loaded: true,
        error: e instanceof Error ? e.message : 'No se pudo cargar el stock',
      })
    }
  },

  upsertProduct: async (insert) => {
    return api.createProduct(insert)
  },

  addToStock: async (product: Product, delta: number) => {
    const next = await api.addStock(product.id, delta)
    await get().fetchStock()
    return next
  },

  adjustItem: async (stockItemId: string, delta: number) => {
    const item = get().items.find((i) => i.id === stockItemId)
    if (!item) return
    const next = Math.max(0, item.quantity + delta)
    if (next === item.quantity) return

    // optimistic update so steppers feel instant
    set({
      items: get().items.map((i) => (i.id === stockItemId ? { ...i, quantity: next } : i)),
    })

    try {
      await api.patchStock(stockItemId, { quantity: next })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'No se pudo actualizar' })
      await get().fetchStock()
    }
  },

  setQuantities: async (stockItemId: string, quantity: number, minQty: number) => {
    await api.patchStock(stockItemId, {
      quantity: Math.max(0, quantity),
      minQty: Math.max(0, minQty),
    })
    await get().fetchStock()
  },

  deleteItem: async (stockItemId: string) => {
    await api.deleteStock(stockItemId)
    await get().fetchStock()
  },
}))
