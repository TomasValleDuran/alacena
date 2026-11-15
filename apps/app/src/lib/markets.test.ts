import { marketPrice } from '@/test-utils/factories'

import { MY_MARKETS, myMarkets, myMarketsLabel, priceSpread } from './markets'

describe('myMarkets', () => {
  it('keeps only our stores, ignoring case and accents', () => {
    const out = myMarkets([
      marketPrice({ market: 'Walmart', price: 1 }),
      marketPrice({ market: 'DÍA', price: 50 }),
      marketPrice({ market: 'coto', price: 60 }),
      marketPrice({ market: ' Vea ', price: 70 }),
    ])
    expect(out.map((m) => m.market)).toEqual(['DÍA', 'coto', ' Vea '])
  })

  it('sorts cheapest first', () => {
    const out = myMarkets([
      marketPrice({ market: 'Jumbo', price: 300 }),
      marketPrice({ market: 'Coto', price: 100 }),
      marketPrice({ market: 'Disco', price: 200 }),
    ])
    expect(out.map((m) => m.market)).toEqual(['Coto', 'Disco', 'Jumbo'])
  })

  it('uses the paid price for plain promos and has no bundle', () => {
    const [m] = myMarkets([marketPrice({ price: 80, listPrice: 100, promo: '20% off' })])
    expect(m.unitPrice).toBe(80)
    expect(m.bundlePrice).toBeNull()
  })

  it.each([
    ['50% 2da', 2],
    ['70% 2do', 2],
    ['2x1', 2],
    ['3x2', 3],
    ['2 x 1', 2],
  ])('treats %j as a multi-buy: ranks by shelf price, bundle of %i', (promo, size) => {
    const [m] = myMarkets([marketPrice({ price: 75, listPrice: 100, promo })])
    expect(m.unitPrice).toBe(100)
    expect(m.bundlePrice).toBe(75)
    expect(m.bundleSize).toBe(size)
  })

  it('ranks a multi-buy promo by single-unit price, not the bundle price', () => {
    const out = myMarkets([
      marketPrice({ market: 'Coto', price: 75, listPrice: 100, promo: '50% 2da' }),
      marketPrice({ market: 'Jumbo', price: 90 }),
    ])
    // the bundle makes Coto look like 75, but one bottle costs 100 there
    expect(out.map((m) => [m.market, m.unitPrice])).toEqual([
      ['Jumbo', 90],
      ['Coto', 100],
    ])
  })

  it('falls back to the paid price when a multi-buy promo has no list price', () => {
    const [m] = myMarkets([marketPrice({ price: 75, listPrice: null, promo: '2x1' })])
    expect(m.unitPrice).toBe(75)
    expect(m.bundlePrice).toBeNull()
  })

  it('does not mistake an ordinary percentage promo for a multi-buy', () => {
    const [m] = myMarkets([marketPrice({ price: 70, listPrice: 100, promo: '30% de descuento' })])
    expect(m.bundlePrice).toBeNull()
    expect(m.unitPrice).toBe(70)
  })

  it('returns an empty list for no data', () => {
    expect(myMarkets([])).toEqual([])
  })
})

describe('myMarketsLabel', () => {
  it('lists every store, joining the last with "ni"', () => {
    const label = myMarketsLabel()
    expect(label).toBe('Coto, Carrefour, Easy, Farmacity, Jumbo, Sodimac, Dia, Disco ni Vea')
    for (const name of MY_MARKETS) expect(label).toContain(name)
  })
})

describe('priceSpread', () => {
  const ranked = (...prices: [string, number][]) =>
    myMarkets(prices.map(([market, price]) => marketPrice({ market, price })))

  it('says nothing with fewer than two markets', () => {
    expect(priceSpread([])).toEqual({ percent: 0, summary: null, highlightCheapest: false })
    expect(priceSpread(ranked(['Coto', 100]))).toEqual({ percent: 0, summary: null, highlightCheapest: false })
  })

  it('names the cheapest and the priciest when the gap is 3% or more', () => {
    expect(priceSpread(ranked(['Jumbo', 200], ['Coto', 150], ['Dia', 180]))).toEqual({
      percent: 25,
      summary: 'En Coto pagás 25% menos que en Jumbo',
      highlightCheapest: true,
    })
  })

  it('compares against the most expensive, not the runner-up', () => {
    expect(priceSpread(ranked(['Coto', 97], ['Dia', 98], ['Jumbo', 100])).summary).toBe(
      'En Coto pagás 3% menos que en Jumbo',
    )
  })

  it('calls 1–2% "casi lo mismo" but still highlights the cheapest', () => {
    expect(priceSpread(ranked(['Coto', 98], ['Jumbo', 100]))).toEqual({
      percent: 2,
      summary: 'Cuesta casi lo mismo en todos',
      highlightCheapest: true,
    })
  })

  it('rounds the percentage before applying the thresholds', () => {
    // 2.6% rounds to 3 → named; 0.4% rounds to 0 → no highlight
    expect(priceSpread(ranked(['Coto', 97.4], ['Jumbo', 100])).percent).toBe(3)
    expect(priceSpread(ranked(['Coto', 97.4], ['Jumbo', 100])).summary).toBe('En Coto pagás 3% menos que en Jumbo')
    expect(priceSpread(ranked(['Coto', 99.6], ['Jumbo', 100]))).toEqual({
      percent: 0,
      summary: 'Cuesta casi lo mismo en todos',
      highlightCheapest: false,
    })
  })

  it('treats equal prices as the same everywhere, with no highlight', () => {
    expect(priceSpread(ranked(['Coto', 100], ['Jumbo', 100]))).toEqual({
      percent: 0,
      summary: 'Cuesta casi lo mismo en todos',
      highlightCheapest: false,
    })
  })

  it('uses the single-unit price for multi-buy promos', () => {
    const markets = myMarkets([
      marketPrice({ market: 'Coto', price: 50, listPrice: 100, promo: '2x1' }),
      marketPrice({ market: 'Jumbo', price: 90 }),
    ])
    expect(priceSpread(markets).summary).toBe('En Jumbo pagás 10% menos que en Coto')
  })
})
