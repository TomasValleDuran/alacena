import { fold } from './text'
import type { MarketPrice } from './types'

/**
 * The stores this household actually shops at (supermarkets, plus a pharmacy
 * and home-improvement chains). Prices from any other market pricely tracks
 * are ignored. Names as pricely spells them; matching ignores case and accents.
 */
export const MY_MARKETS = [
  'Coto',
  'Carrefour',
  'Easy',
  'Farmacity',
  'Jumbo',
  'Sodimac',
  'Dia',
  'Disco',
  'Vea',
] as const

const key = (s: string) => fold(s).trim()
const mine = new Set(MY_MARKETS.map(key))

/**
 * Promos that need several units ("50% 2da", "2x1", "3x2", "70% 2do") give a
 * per-unit price that only holds if you buy the bundle. Ranking by it would
 * say "Coto is 25% cheaper" for someone buying one bottle — so those rank by
 * the single-unit shelf price and the deal is shown on the side.
 */
function isMultiBuy(promo: string | null): boolean {
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

export type PriceSpread = {
  /** how much less our cheapest charges than our most expensive, in whole % (0 with fewer than two markets) */
  percent: number
  /** one-line answer to "is it worth choosing?"; null with fewer than two markets */
  summary: string | null
  /** whether the cheapest is far enough ahead to call out as "El más barato" */
  highlightCheapest: boolean
}

/** Spread between our cheapest and most expensive market. Takes `myMarkets()` output (cheapest first). */
export function priceSpread(markets: MyPrice[]): PriceSpread {
  if (markets.length < 2) return { percent: 0, summary: null, highlightCheapest: false }
  const cheapest = markets[0]
  const priciest = markets[markets.length - 1]
  const percent = Math.round((1 - cheapest.unitPrice / priciest.unitPrice) * 100)
  return {
    percent,
    summary:
      percent >= 3
        ? `En ${cheapest.market} pagás ${percent}% menos que en ${priciest.market}`
        : 'Cuesta casi lo mismo en todos',
    highlightCheapest: percent >= 1,
  }
}

/** The stores as a Spanish list, e.g. "Coto, Carrefour, Easy, Farmacity, Jumbo, Sodimac, Dia, Disco ni Vea". */
export function myMarketsLabel(): string {
  return `${MY_MARKETS.slice(0, -1).join(', ')} ni ${MY_MARKETS[MY_MARKETS.length - 1]}`
}
