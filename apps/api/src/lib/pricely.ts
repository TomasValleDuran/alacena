import type { ProductInsert } from './types.js'
import { isEan } from './barcode.js'

/**
 * api.pricely.ar — the private API behind pricely.ar (Argentine price tracker).
 * Undocumented and deliberately obfuscated: it can change or disappear at any
 * time. Every function here degrades to `null` instead of throwing, so the
 * scanner keeps working (Open Food Facts fallback) and prices just go missing.
 */

const API = 'https://api.pricely.ar'

type PricelyProduct = {
  ean?: number
  name?: string
  imagePath?: string
  blurHash?: string
  description?: string
  avgPrice?: number
  minPrice?: number
  minPriceMarket?: string
  updatedAt?: string
}

type PricelyMarketPrice = {
  price?: number
  discountPrice?: number
  discountDetails?: string
  url?: string
  updatedAt?: string
}

type PricelyPrices = {
  avgPrice?: number
  avgDiscountPrice?: number
  markets?: Record<string, PricelyMarketPrice>
}

type PricelyCategory = { id: number; name: string }

/**
 * Bodies are the base64 of the JSON, reversed, with one extra character
 * appended (which lands at the front once reversed). Undo: reverse → drop
 * first char → base64 → UTF-8 JSON.
 */
function decodePricely<T>(raw: string): T {
  let s = raw.trim().split('').reverse().join('').slice(1)
  s += '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(s)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as T
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return decodePricely<T>(await res.text())
  } catch {
    // network error, timeout, or the encoding changed — treat as "not available"
    return null
  }
}

const pricelyImageUrl = (path: string | undefined) => (path ? `https://images.pricely.ar/${path}` : null)

/**
 * Lookup for the scan path. Product + categories go out in parallel, so the
 * categories (used to group the pantry by aisle) cost no extra wait.
 */
export async function lookupPricely(barcode: string): Promise<ProductInsert | null> {
  if (!isEan(barcode)) return null
  const code = encodeURIComponent(barcode)
  const [data, cats] = await Promise.all([
    get<PricelyProduct>(`/product/${code}`),
    get<PricelyCategory[]>(`/product/${code}/categories`),
  ])
  const name = data?.name?.trim()
  if (!data || !name) return null

  return {
    barcode,
    name,
    brand: null,
    imageUrl: pricelyImageUrl(data.imagePath),
    category: null,
    unit: null,
    description: data.description?.trim() || null,
    blurHash: data.blurHash || null,
    categories: cleanCategories(cats),
  }
}

/** Just the category tags (backfill for products saved before they were stored). */
export async function pricelyCategories(barcode: string): Promise<string[] | null> {
  if (!isEan(barcode)) return null
  const cats = await get<PricelyCategory[]>(`/product/${encodeURIComponent(barcode)}/categories`)
  return cats ? cleanCategories(cats) : null
}

/* ------------------------------------------------------------ insights */

export type MarketPrice = {
  market: string
  /** what you pay: the promo price when there is one */
  price: number
  /** shelf price before the promo (null when there's no promo) */
  listPrice: number | null
  promo: string | null
  url: string | null
  updatedAt: string | null
}

export type PricelyInsights = {
  /** cheapest first */
  markets: MarketPrice[]
  avgPrice: number | null
  categories: string[]
  description: string | null
  blurHash: string | null
  imageUrl: string | null
}

function toMarkets(prices: PricelyPrices | null): MarketPrice[] {
  const out: MarketPrice[] = []
  for (const [market, m] of Object.entries(prices?.markets ?? {})) {
    if (!market.trim() || !m.price || m.price <= 0) continue
    const promo = m.discountPrice != null && m.discountPrice > 0 && m.discountPrice < m.price
    out.push({
      market,
      price: promo ? m.discountPrice! : m.price,
      listPrice: promo ? m.price : null,
      promo: promo ? m.discountDetails?.trim() || 'Promo' : null,
      url: m.url || null,
      updatedAt: m.updatedAt || null,
    })
  }
  return out.sort((a, b) => a.price - b.price)
}

/** Category tags come generic → specific with duplicates ("almacén", "almacen"). */
function cleanCategories(cats: PricelyCategory[] | null): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of cats ?? []) {
    const name = c.name?.trim()
    if (!name) continue
    const key = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    if (key === 'supermercado' || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

// prices move daily; 10 minutes is fresh enough and spares pricely repeat hits
const TTL_MS = 10 * 60 * 1000
const CACHE_MAX = 500
const cache = new Map<string, { at: number; value: PricelyInsights | null }>()

/** Live prices per market + categories (+ product extras), cached for 10 min. */
export async function pricelyInsights(barcode: string): Promise<PricelyInsights | null> {
  if (!isEan(barcode)) return null
  const hit = cache.get(barcode)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  const code = encodeURIComponent(barcode)
  const [product, prices, categories] = await Promise.all([
    get<PricelyProduct>(`/product/${code}`),
    get<PricelyPrices>(`/product/${code}/prices`),
    get<PricelyCategory[]>(`/product/${code}/categories`),
  ])

  const value: PricelyInsights | null =
    product || prices || categories
      ? {
          markets: toMarkets(prices),
          avgPrice: prices?.avgPrice ?? product?.avgPrice ?? null,
          categories: cleanCategories(categories),
          description: product?.description?.trim() || null,
          blurHash: product?.blurHash || null,
          imageUrl: pricelyImageUrl(product?.imagePath),
        }
      : null

  // a miss/failure is only remembered for a minute, so a blip doesn't hide prices for 10
  cache.delete(barcode) // re-insert so Map order stays oldest-first
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
  cache.set(barcode, { at: value ? Date.now() : Date.now() - TTL_MS + 60_000, value })
  return value
}
