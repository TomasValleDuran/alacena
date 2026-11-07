import type { MarketPrice } from './types'

/**
 * The supermarkets this household actually shops at. Prices from any other
 * market pricely tracks are ignored. Names as pricely spells them; matching
 * ignores case and accents.
 */
export const MY_MARKETS = ['Carrefour', 'Coto', 'Vea', 'Jumbo', 'Disco'] as const

const key = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
const mine = new Set(MY_MARKETS.map(key))

/**
 * Promos that need several units ("50% 2da", "2x1", "3x2", "70% 2do") give a
 * per-unit price that only holds if you buy the bundle. Ranking by it would
 * say "Coto is 25% cheaper" for someone buying one bottle — so those rank by
 * the single-unit shelf price and the deal is shown on the side.
 */
export function isMultiBuy(promo: string | null): boolean {
  return !!promo && /\b(2da|2do|segund[ao]|\d\s*x\s*\d)\b/i.test(promo)
}

export type MyPrice = MarketPrice & {
  /** price for buying one */
  unitPrice: number
  /** per-unit price when buying the bundle (multi-buy promos only) */
  bundlePrice: number | null
  /** how many to take for bundlePrice: 3 for "3x2", 2 for "2x1" / "50% 2da" */
  bundleSize: number
}

/** Only our markets, cheapest single unit first. */
export function myMarkets(markets: MarketPrice[]): MyPrice[] {
  return markets
    .filter((m) => mine.has(key(m.market)))
    .map((m) => {
      const multi = isMultiBuy(m.promo) && m.listPrice != null
      const nxm = m.promo?.match(/(\d)\s*x\s*\d/i)
      return {
        ...m,
        unitPrice: multi ? m.listPrice! : m.price,
        bundlePrice: multi ? m.price : null,
        bundleSize: nxm ? Number(nxm[1]) : 2,
      }
    })
    .sort((a, b) => a.unitPrice - b.unitPrice)
}

/** "Carrefour, Coto, Vea, Jumbo ni Disco" */
export function myMarketsLabel(): string {
  return `${MY_MARKETS.slice(0, -1).join(', ')} ni ${MY_MARKETS[MY_MARKETS.length - 1]}`
}
