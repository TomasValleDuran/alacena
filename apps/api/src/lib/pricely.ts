import type { ProductInsert } from './types.js'

type PricelyProduct = {
  ean?: number
  name?: string
  imagePath?: string
  description?: string
}

/**
 * api.pricely.ar obfuscates responses: the body is the base64 of the JSON,
 * reversed, with one extra character appended (which lands at the front
 * once reversed). Undo: reverse → drop first char → base64 → UTF-8 JSON.
 */
function decodePricely(raw: string): PricelyProduct {
  let s = raw.trim().split('').reverse().join('').slice(1)
  s += '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(s)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as PricelyProduct
}

/** Argentine price-tracker catalog. Great local coverage; no brand/category fields. */
export async function lookupPricely(barcode: string): Promise<ProductInsert | null> {
  if (!/^\d{6,14}$/.test(barcode)) return null

  const res = await fetch(`https://api.pricely.ar/product/${encodeURIComponent(barcode)}`)
  if (!res.ok) return null

  try {
    const data = decodePricely(await res.text())
    const name = data.name?.trim()
    if (!name) return null

    return {
      barcode,
      name,
      brand: null,
      imageUrl: data.imagePath ? `https://images.pricely.ar/${data.imagePath}` : null,
      category: null,
      unit: null,
    }
  } catch {
    // encoding scheme changed or non-JSON payload — treat as not found
    return null
  }
}
