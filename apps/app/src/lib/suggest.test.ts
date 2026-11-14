import { stockRow } from '@/test-utils/factories'

import { suggestedQty, suggestFromPantry } from './suggest'

const row = (id: string, name: string, quantity = 2, minQty: number | null = null, brand: string | null = null) =>
  stockRow({ productId: id, quantity, minQty, product: { name, brand } })

const names = (rows: ReturnType<typeof suggestFromPantry>) => rows.map((r) => r.product.name)

describe('suggestFromPantry', () => {
  const items = [
    row('1', 'Aceite Girasol', 2, null, 'Cocinero'),
    row('2', 'Multipack Agua'),
    row('3', 'Azúcar'),
    row('4', 'Arroz Largo Fino', 2, null, 'Gallo'),
  ]

  it('needs at least two characters', () => {
    expect(suggestFromPantry(items, '')).toEqual([])
    expect(suggestFromPantry(items, 'a')).toEqual([])
    expect(suggestFromPantry(items, '  a ')).toEqual([])
  })

  it('every typed word must start some word of name or brand', () => {
    expect(names(suggestFromPantry(items, 'aceite coc'))).toEqual(['Aceite Girasol'])
    expect(names(suggestFromPantry(items, 'cocinero'))).toEqual(['Aceite Girasol']) // brand
    expect(suggestFromPantry(items, 'aceite xyz')).toEqual([])
  })

  it('matches word starts only, not the middle of a word', () => {
    // "ac" would hit "Multipack" if substrings counted
    expect(names(suggestFromPantry(items, 'ac'))).toEqual(['Aceite Girasol'])
    expect(suggestFromPantry(items, 'pack')).toEqual([])
  })

  it('ignores case, accents and extra spaces', () => {
    expect(names(suggestFromPantry(items, 'AZUCAR'))).toEqual(['Azúcar'])
    expect(names(suggestFromPantry(items, 'azúcar'))).toEqual(['Azúcar'])
    expect(names(suggestFromPantry(items, '  arroz    lar '))).toEqual(['Arroz Largo Fino'])
  })

  it('ranks name-prefix matches first, then restock needs, then A-Z', () => {
    const rows = [
      row('a', 'Yerba Suave Amanda', 5), // contains "su", not a prefix, in stock
      row('b', 'Sal Fina', 5), // prefix, in stock
      row('c', 'Sal Gruesa', 1, 3), // prefix, low
      row('d', 'Sopa Sustancia', 0), // "su" starts a later word, not the name; out of stock
      row('e', 'Suavizante', 5), // prefix, in stock
      row('f', 'Suero', 0), // prefix, out of stock
    ]
    expect(names(suggestFromPantry(rows, 'su'))).toEqual(['Suero', 'Suavizante', 'Sopa Sustancia', 'Yerba Suave Amanda'])
    expect(names(suggestFromPantry(rows, 'sal'))).toEqual(['Sal Gruesa', 'Sal Fina'])
  })

  it('respects the limit (default 5)', () => {
    const many = Array.from({ length: 8 }, (_, i) => row(String(i), `Galletitas ${i}`))
    expect(suggestFromPantry(many, 'gall')).toHaveLength(5)
    expect(suggestFromPantry(many, 'gall', 2)).toHaveLength(2)
  })

  it('does not fail on products without a brand', () => {
    expect(names(suggestFromPantry([row('1', 'Fideos')], 'fid'))).toEqual(['Fideos'])
  })
})

describe('suggestedQty', () => {
  it('is 1 when no minimum is set', () => {
    expect(suggestedQty(row('1', 'x', 0, null))).toBe(1)
    expect(suggestedQty(row('1', 'x', 4, 0))).toBe(1)
  })

  it('tops the stock up to the minimum', () => {
    expect(suggestedQty(row('1', 'x', 1, 4))).toBe(3)
    expect(suggestedQty(row('1', 'x', 0, 2))).toBe(2)
  })

  it('is never below 1, even at or above the minimum', () => {
    expect(suggestedQty(row('1', 'x', 4, 4))).toBe(1)
    expect(suggestedQty(row('1', 'x', 9, 4))).toBe(1)
  })
})
