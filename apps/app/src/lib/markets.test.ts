import { marketPrice } from '@/test-utils/factories'

import { MY_MARKETS, myMarkets, myMarketsLabel } from './markets'

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
