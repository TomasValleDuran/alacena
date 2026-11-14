import { stockRow } from '@/test-utils/factories'

import { buildSections, matchesFilter } from './pantry-sections'

type Opts = Parameters<typeof buildSections>[1]
const opts = (over: Partial<Opts> = {}): Opts => ({
  filter: 'all',
  query: '',
  groupBy: 'aisle',
  sortBy: 'name',
  listed: new Set(),
  ...over,
})

const row = (
  id: string,
  name: string,
  quantity: number,
  extra: { minQty?: number | null; categories?: string[]; brand?: string | null; updatedAt?: string } = {},
) =>
  stockRow({
    productId: id,
    quantity,
    minQty: extra.minQty ?? null,
    updatedAt: extra.updatedAt ?? '2026-01-01T00:00:00.000Z',
    product: { name, brand: extra.brand ?? null, categories: extra.categories },
  })

const items = [
  row('1', 'Leche', 0, { categories: ['lacteos'], minQty: 2 }), // out
  row('2', 'Yogur', 1, { categories: ['frescos'], minQty: 2 }), // low
  row('3', 'Arroz', 5, { categories: ['almacen'] }), // ok
  row('4', 'Lavandina', 3, { categories: ['limpieza'], minQty: 1 }), // ok
  row('5', 'Mystery', 2), // no categories -> otros, ok
]

describe('matchesFilter', () => {
  const listed = new Set(['3'])
  it.each([
    ['all', ['1', '2', '3', '4', '5']],
    ['restock', ['1', '2']],
    ['out', ['1']],
    ['inStock', ['2', '3', '4', '5']],
    ['onList', ['3']],
  ] as const)('%s', (filter, ids) => {
    expect(items.filter((r) => matchesFilter(r, filter, listed)).map((r) => r.productId)).toEqual(ids)
  })
})

describe('buildSections grouping', () => {
  it('groups by aisle in aisle order and drops empty sections', () => {
    const s = buildSections(items, opts())
    expect(s.map((x) => x.key)).toEqual(['aisle:almacen', 'aisle:frescos', 'aisle:limpieza', 'aisle:otros'])
    expect(s.map((x) => x.title)).toEqual(['Almacén', 'Lácteos y frescos', 'Limpieza', 'Otros'])
    // "Leche" (lacteos) and "Yogur" (frescos) share an aisle
    expect(s[1].rows.map((r) => r.product.name)).toEqual(['Leche', 'Yogur'])
  })

  it('groups by status: out, low, ok', () => {
    const s = buildSections(items, opts({ groupBy: 'status' }))
    expect(s.map((x) => [x.key, x.title, x.rows.map((r) => r.product.name)])).toEqual([
      ['status:out', 'Agotado', ['Leche']],
      ['status:low', 'Por reponer', ['Yogur']],
      ['status:ok', 'Con stock', ['Arroz', 'Lavandina', 'Mystery']],
    ])
  })

  it('"none" puts everything in one section', () => {
    const s = buildSections(items, opts({ groupBy: 'none' }))
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ key: 'all', title: 'Todo' })
    expect(s[0].rows).toHaveLength(5)
  })

  it('counts rows needing restock (low or out) per section', () => {
    const byAisle = buildSections(items, opts())
    expect(byAisle.map((x) => [x.key, x.restock])).toEqual([
      ['aisle:almacen', 0],
      ['aisle:frescos', 2],
      ['aisle:limpieza', 0],
      ['aisle:otros', 0],
    ])
    const byStatus = buildSections(items, opts({ groupBy: 'status' }))
    expect(byStatus.map((x) => x.restock)).toEqual([1, 1, 0])
  })

  it('returns no sections for an empty pantry', () => {
    expect(buildSections([], opts())).toEqual([])
  })
})

describe('buildSections sorting', () => {
  const sorted = (sortBy: Opts['sortBy'], rows = items) =>
    buildSections(rows, opts({ groupBy: 'none', sortBy }))[0].rows.map((r) => r.product.name)

  it('by name, accent- and case-insensitive (Spanish collation)', () => {
    const rows = [row('a', 'zanahoria', 1), row('b', 'Ñoquis', 1), row('c', 'árbol de té', 1), row('d', 'Nuez', 1)]
    expect(sorted('name', rows)).toEqual(['árbol de té', 'Nuez', 'Ñoquis', 'zanahoria'])
  })

  it('by quantity ascending, ties by name', () => {
    const rows = [row('a', 'B', 2), row('b', 'A', 2), row('c', 'C', 0)]
    expect(sorted('qty', rows)).toEqual(['C', 'A', 'B'])
  })

  it('by most recently updated first', () => {
    const rows = [
      row('a', 'Old', 1, { updatedAt: '2026-01-01T00:00:00.000Z' }),
      row('b', 'New', 1, { updatedAt: '2026-03-01T00:00:00.000Z' }),
      row('c', 'Mid', 1, { updatedAt: '2026-02-01T00:00:00.000Z' }),
    ]
    expect(sorted('recent', rows)).toEqual(['New', 'Mid', 'Old'])
  })

  it('sorts within each section', () => {
    const s = buildSections(items, opts({ sortBy: 'qty' }))
    expect(s[1].rows.map((r) => r.product.name)).toEqual(['Leche', 'Yogur'])
  })
})

describe('buildSections filter and search', () => {
  it('applies the filter before grouping', () => {
    const s = buildSections(items, opts({ filter: 'restock', groupBy: 'status' }))
    expect(s.map((x) => x.key)).toEqual(['status:out', 'status:low'])
  })

  it('onList uses the listed product ids', () => {
    const s = buildSections(items, opts({ filter: 'onList', groupBy: 'none', listed: new Set(['3', '4']) }))
    expect(s[0].rows.map((r) => r.productId)).toEqual(['3', '4'])
  })

  it('searches name and brand ignoring case and accents', () => {
    const rows = [row('1', 'Café molido', 1, { brand: 'La Virginia' }), row('2', 'Té', 1, { brand: 'Taragüi' })]
    const names = (q: string) =>
      buildSections(rows, opts({ groupBy: 'none', query: q })).flatMap((s) => s.rows.map((r) => r.product.name))
    expect(names('CAFE')).toEqual(['Café molido'])
    expect(names('virginia')).toEqual(['Café molido'])
    expect(names('taragui')).toEqual(['Té'])
    expect(names('  molido  ')).toEqual(['Café molido']) // query is trimmed
    expect(names('zzz')).toEqual([])
  })

  it('search is a substring match (unlike the quick-add suggestions)', () => {
    const rows = [row('1', 'Multipack Agua', 1)]
    expect(buildSections(rows, opts({ query: 'pack' }))).toHaveLength(1)
  })

  it('does not mutate the input array order', () => {
    const copy = [...items]
    buildSections(items, opts({ sortBy: 'qty', groupBy: 'none' }))
    expect(items).toEqual(copy)
  })
})
