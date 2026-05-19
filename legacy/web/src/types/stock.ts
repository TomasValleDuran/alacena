import type { Product } from '@/types/product'

export type StockItem = {
  id: string
  product_id: string
  quantity: number
  min_qty: number | null
  updated_at: string
}

export type StockItemWithProduct = StockItem & {
  product: Product
}
