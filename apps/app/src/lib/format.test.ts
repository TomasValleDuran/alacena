import { money, priceAge } from './format'

describe('money', () => {
  it('formats whole pesos with es-AR grouping', () => {
    expect(money(7415).replace(/\s/g, ' ')).toBe('$ 7.415')
    expect(money(1234567).replace(/\s/g, ' ')).toBe('$ 1.234.567')
  })

  it('rounds to whole pesos', () => {
    expect(money(99.6).replace(/\s/g, ' ')).toBe('$ 100')
  })
})

describe('priceAge', () => {
  const NOW = Date.parse('2026-06-30T12:00:00Z')
  const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString()

  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW))
  afterEach(() => jest.restoreAllMocks())

  it('says nothing for missing or fresh (< 2 days) prices', () => {
    expect(priceAge(null)).toBeNull()
    expect(priceAge(ago(0))).toBeNull()
    expect(priceAge(ago(1))).toBeNull()
  })

  it('reports days from 2 up to 29', () => {
    expect(priceAge(ago(2))).toBe('hace 2 días')
    expect(priceAge(ago(29))).toBe('hace 29 días')
  })

  it('collapses 30+ days into "more than a month"', () => {
    expect(priceAge(ago(30))).toBe('hace más de un mes')
    expect(priceAge(ago(200))).toBe('hace más de un mes')
  })

  it('ignores garbage dates', () => {
    expect(priceAge('not a date')).toBeNull()
  })
})
