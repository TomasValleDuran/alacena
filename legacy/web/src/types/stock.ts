import type { Product } from '@/types/product'

export type StockItem = {
  id: string
  productId: string
  quantity: number
  minQty: number | null
  updatedAt: string
}

export type StockItemWithProduct = StockItem & {
  product: Product
}
