import type { MarketPrice, Product, ShoppingRow, StockRow } from '@/lib/types'

export function product(over: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    barcode: '7790070410122',
    name: 'Producto',
    brand: null,
    imageUrl: null,
    category: null,
    unit: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

export function stockRow(over: Partial<StockRow> & { product?: Partial<Product> } = {}): StockRow {
  const { product: p, ...rest } = over
  const prod = product({ id: rest.productId ?? 'p1', ...p })
  return {
    id: `s-${prod.id}`,
    productId: prod.id,
    quantity: 1,
    minQty: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...rest,
    product: prod,
  }
}

export function shoppingRow(over: Partial<ShoppingRow> = {}): ShoppingRow {
  return {
    id: 'l1',
    productId: null,
    name: 'Algo',
    quantity: 1,
    checked: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    product: null,
    ...over,
  }
}

export function marketPrice(over: Partial<MarketPrice> = {}): MarketPrice {
  return { market: 'Coto', price: 100, listPrice: null, promo: null, url: null, updatedAt: null, ...over }
}
