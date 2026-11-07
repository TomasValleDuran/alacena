import type { Product, StockItem, ShoppingItem, Prisma } from '@prisma/client'

/**
 * Prisma gives camelCase fields but Decimal/Date values; the wire format is
 * plain JSON (numbers + ISO strings). These mappers do just that conversion —
 * the key names already match the frontend types.
 */

function num(d: Prisma.Decimal | null): number | null {
  return d == null ? null : Number(d)
}

export function serializeProduct(p: Product) {
  return {
    id: p.id,
    barcode: p.barcode,
    name: p.name,
    brand: p.brand,
    imageUrl: p.imageUrl,
    category: p.category,
    unit: p.unit,
    description: p.description,
    blurHash: p.blurHash,
    categories: p.categories,
    createdAt: p.createdAt.toISOString(),
  }
}

export function serializeStockItem(s: StockItem & { product: Product }) {
  return {
    id: s.id,
    productId: s.productId,
    quantity: Number(s.quantity),
    minQty: num(s.minQty),
    updatedAt: s.updatedAt.toISOString(),
    product: serializeProduct(s.product),
  }
}

export function serializeShoppingItem(s: ShoppingItem & { product: Product | null }) {
  return {
    id: s.id,
    productId: s.productId,
    name: s.name,
    quantity: Number(s.quantity),
    checked: s.checked,
    createdAt: s.createdAt.toISOString(),
    product: s.product ? serializeProduct(s.product) : null,
  }
}
