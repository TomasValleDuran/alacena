// Wire shapes from the API (apps/api/src/serialize.ts) (camelCase JSON: numbers + ISO date strings).

export type Product = {
  id: string
  barcode: string
  name: string
  brand: string | null
  imageUrl: string | null
  category: string | null
  unit: string | null
  description?: string | null
  blurHash?: string | null
  categories?: string[]
  createdAt: string
}

/** One supermarket's price for a product (from pricely, live). */
export type MarketPrice = {
  market: string
  /** what you pay: the promo price when there is one */
  price: number
  /** shelf price before the promo; null = no promo */
  listPrice: number | null
  promo: string | null
  url: string | null
  updatedAt: string | null
}

export type Insights = {
  product: Product
  /** null = pricely doesn't know this product (or is down) */
  prices: { markets: MarketPrice[]; avgPrice: number | null; cheapest: MarketPrice | null } | null
}

export type StockRow = {
  id: string
  productId: string
  quantity: number
  minQty: number | null
  updatedAt: string
  product: Product
}

export type ShoppingRow = {
  id: string
  productId: string | null
  name: string | null
  quantity: number
  checked: boolean
  createdAt: string
  product: Product | null
}

export type StockLevel = 'ok' | 'low' | 'out'

/** Same rule the backend uses for "Agregar los que faltan". */
export function stockLevel(quantity: number, minQty: number | null): StockLevel {
  if (quantity <= 0) return 'out'
  if (minQty != null && minQty > 0 && quantity <= minQty) return 'low'
  return 'ok'
}

export function shoppingName(row: ShoppingRow): string {
  return row.product?.name ?? row.name ?? 'Sin nombre'
}
