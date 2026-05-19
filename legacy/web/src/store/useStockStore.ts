import { create } from 'zustand'
import type { Product, ProductInsert } from '@/types/product'
import type { StockItemWithProduct } from '@/types/stock'
import { supabase } from '@/lib/supabase'

type StockState = {
  items: StockItemWithProduct[]
  loading: boolean
  error: string | null
  fetchStock: () => Promise<void>
  /** Insert or return existing product by barcode */
  upsertProduct: (insert: ProductInsert) => Promise<Product>
  /** Add quantity to stock for an existing product (creates row if missing) */
  addOrUpdateItem: (product: Product, additionalQty: number) => Promise<void>
  incrementItem: (stockItemId: string) => Promise<void>
  decrementItem: (stockItemId: string) => Promise<void>
  setStockQuantity: (stockItemId: string, quantity: number) => Promise<void>
  setMinQty: (stockItemId: string, minQty: number) => Promise<void>
  deleteItem: (stockItemId: string) => Promise<void>
}

type StockRow = {
  id: string
  product_id: string
  quantity: string | number
  min_qty: string | number | null
  updated_at: string
  product: Product
}

function normalize(row: StockRow): StockItemWithProduct {
  return {
    id: row.id,
    product_id: row.product_id,
    quantity: Number(row.quantity),
    min_qty: row.min_qty == null ? null : Number(row.min_qty),
    updated_at: row.updated_at,
    product: row.product,
  }
}

export const useStockStore = create<StockState>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchStock: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('stock_items')
      .select(
        `
        id,
        product_id,
        quantity,
        min_qty,
        updated_at,
        product:products (*)
      `,
      )
      .order('updated_at', { ascending: false })

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    const rows = (data ?? []) as unknown as StockRow[]
    set({
      items: rows.map(normalize),
      loading: false,
      error: null,
    })
  },

  upsertProduct: async (insert: ProductInsert) => {
    const { data: existing, error: findErr } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', insert.barcode)
      .maybeSingle()

    if (findErr) throw new Error(findErr.message)
    if (existing) return existing as Product

    const { data: created, error: insErr } = await supabase
      .from('products')
      .insert({
        barcode: insert.barcode,
        name: insert.name,
        brand: insert.brand ?? null,
        image_url: insert.image_url ?? null,
        category: insert.category ?? null,
        unit: insert.unit ?? null,
      })
      .select('*')
      .single()

    if (insErr) {
      // race: another tab inserted same barcode
      if (insErr.code === '23505') {
        const { data: again } = await supabase
          .from('products')
          .select('*')
          .eq('barcode', insert.barcode)
          .single()
        if (again) return again as Product
      }
      throw new Error(insErr.message)
    }

    return created as Product
  },

  addOrUpdateItem: async (product: Product, additionalQty: number) => {
    if (additionalQty <= 0) return

    const { data: row, error: findErr } = await supabase
      .from('stock_items')
      .select('id, quantity')
      .eq('product_id', product.id)
      .maybeSingle()

    if (findErr) throw new Error(findErr.message)

    const now = new Date().toISOString()

    if (row) {
      const next = Number(row.quantity) + additionalQty
      const { error } = await supabase
        .from('stock_items')
        .update({ quantity: next, updated_at: now })
        .eq('id', row.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase.from('stock_items').insert({
        product_id: product.id,
        quantity: additionalQty,
        min_qty: 0,
        updated_at: now,
      })
      if (error) throw new Error(error.message)
    }

    await get().fetchStock()
  },

  incrementItem: async (stockItemId: string) => {
    const item = get().items.find((i) => i.id === stockItemId)
    if (!item) return
    const next = item.quantity + 1
    const { error } = await supabase
      .from('stock_items')
      .update({ quantity: next, updated_at: new Date().toISOString() })
      .eq('id', stockItemId)
    if (error) throw new Error(error.message)
    await get().fetchStock()
  },

  decrementItem: async (stockItemId: string) => {
    const item = get().items.find((i) => i.id === stockItemId)
    if (!item) return
    const next = Math.max(0, item.quantity - 1)
    const { error } = await supabase
      .from('stock_items')
      .update({ quantity: next, updated_at: new Date().toISOString() })
      .eq('id', stockItemId)
    if (error) throw new Error(error.message)
    await get().fetchStock()
  },

  setStockQuantity: async (stockItemId: string, quantity: number) => {
    const safe = Math.max(0, quantity)
    const { error } = await supabase
      .from('stock_items')
      .update({ quantity: safe, updated_at: new Date().toISOString() })
      .eq('id', stockItemId)
    if (error) throw new Error(error.message)
    await get().fetchStock()
  },

  setMinQty: async (stockItemId: string, minQty: number) => {
    const safe = Math.max(0, minQty)
    const { error } = await supabase
      .from('stock_items')
      .update({ min_qty: safe, updated_at: new Date().toISOString() })
      .eq('id', stockItemId)
    if (error) throw new Error(error.message)
    await get().fetchStock()
  },

  deleteItem: async (stockItemId: string) => {
    const { error } = await supabase.from('stock_items').delete().eq('id', stockItemId)
    if (error) throw new Error(error.message)
    await get().fetchStock()
  },
}))
