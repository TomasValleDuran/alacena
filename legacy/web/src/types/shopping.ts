import type { Product } from '@/types/product'

export type ShoppingItem = {
  id: string
  /** linked catalog product, or null for a free-text item */
  product_id: string | null
  /** free-text name; ignored when product_id is set (use product.name) */
  name: string | null
  quantity: number
  checked: boolean
  created_at: string
  product: Product | null
}

/** Name to show, whether the row is product-linked or free text. */
export function shoppingItemName(item: ShoppingItem): string {
  return item.product?.name ?? item.name ?? 'Sin nombre'
}
