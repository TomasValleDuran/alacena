import type { ProductInsert } from '@/types/product'

type OffProduct = {
  product_name?: string
  brands?: string
  image_front_url?: string
  categories?: string
  quantity?: string
}

type OffResponse = {
  status: 0 | 1
  product?: OffProduct
}

function firstCategory(categories: string | undefined): string | null {
  if (!categories) return null
  const first = categories.split(',')[0]?.trim()
  return first || null
}

/** Parse strings like "500 g", "1 L", "6x330ml" into a simple unit hint */
export function parsePackagingUnit(quantityStr: string | undefined): string | null {
  if (!quantityStr) return null
  const s = quantityStr.toLowerCase().replaceAll(/\s+/g, '')
  if (/\d+(g|kg)\b/.test(s) || s.includes('g')) return 'g'
  if (/\d+(ml|l)\b/.test(s) || s.includes('ml') || /\dl\b/.test(s)) return 'ml'
  if (/\d+u\b/.test(s) || s.includes('unidad')) return 'u'
  return null
}

export async function lookupBarcode(barcode: string): Promise<ProductInsert | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`,
  )
  if (!res.ok) return null

  const data = (await res.json()) as OffResponse
  if (data.status !== 1 || !data.product) return null

  const p = data.product
  const name = p.product_name?.trim()
  if (!name) return null

  return {
    barcode,
    name,
    brand: p.brands?.trim() || null,
    image_url: p.image_front_url || null,
    category: firstCategory(p.categories),
    unit: parsePackagingUnit(p.quantity),
  }
}
