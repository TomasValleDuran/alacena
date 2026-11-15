import { api } from '@/lib/api'
import { deferred } from '@/test-utils/mock-api'
import { product, shoppingRow, stockRow } from '@/test-utils/factories'

import { isOnList, useShopping } from './shopping'
import { useStock } from './stock'

jest.mock('@/lib/api', () => jest.requireActual('@/test-utils/mock-api').mockApiModule())

const mocked = api as jest.Mocked<typeof api>
const initialShopping = useShopping.getState()
const initialStock = useStock.getState()

const items = () => useShopping.getState().items
const row = (id: string, over: Parameters<typeof shoppingRow>[0] = {}) => shoppingRow({ id, ...over })

beforeEach(() => {
  jest.resetAllMocks()
  useShopping.setState(initialShopping, true)
  useStock.setState(initialStock, true)
})

describe('isOnList', () => {
  const list = [
    row('a', { productId: 'milk', checked: false }),
    row('b', { productId: 'rice', checked: true }),
    row('c', { productId: null, name: 'pilas' }),
  ]

  it('is true only for a product with an unticked row', () => {
    expect(isOnList(list, 'milk')).toBe(true)
    expect(isOnList(list, 'rice')).toBe(false) // bought already
    expect(isOnList(list, 'yerba')).toBe(false)
  })

  it('no product id is never on the list (even with loose rows present)', () => {
    expect(isOnList(list, undefined)).toBe(false)
    expect(isOnList(list, null)).toBe(false)
  })
})

describe('fetch', () => {
  it('first load: loading then ready; later refetches are silent about status', async () => {
    const d = deferred<ReturnType<typeof row>[]>()
    mocked.getShopping.mockReturnValue(d.promise)
    const p = useShopping.getState().fetch()
    expect(useShopping.getState().status).toBe('loading')
    d.resolve([row('a')])
    await p
    expect(useShopping.getState()).toMatchObject({ status: 'ready', error: null })

    mocked.getShopping.mockResolvedValue([])
    const p2 = useShopping.getState().fetch()
    expect(useShopping.getState()).toMatchObject({ status: 'ready', refreshing: true })
    await p2
    expect(items()).toEqual([])
  })

  it('first-load failure is an error state; refresh failure keeps the list', async () => {
    mocked.getShopping.mockRejectedValue(new Error('boom'))
    await useShopping.getState().fetch()
    expect(useShopping.getState()).toMatchObject({ status: 'error', error: 'boom' })

    useShopping.setState({ status: 'ready', items: [row('a')], error: null })
    await useShopping.getState().fetch()
    expect(useShopping.getState()).toMatchObject({ status: 'ready', error: 'boom' })
    expect(items()).toHaveLength(1)
  })
})

describe('toggle', () => {
  const a = row('a', { checked: false })
  beforeEach(() => useShopping.setState({ status: 'ready', items: [a, row('b')] }))

  it('flips optimistically and sends the new value', async () => {
    const d = deferred<typeof a>()
    mocked.patchShopping.mockReturnValue(d.promise)
    const p = useShopping.getState().toggle(a)
    expect(items()[0].checked).toBe(true)
    d.resolve(a)
    await p
    expect(mocked.patchShopping).toHaveBeenCalledWith('a', { checked: true })
  })

  it('rolls back and rethrows on error', async () => {
    mocked.patchShopping.mockRejectedValue(new Error('no'))
    await expect(useShopping.getState().toggle(a)).rejects.toThrow('no')
    expect(items()[0].checked).toBe(false)
  })
})

describe('setQuantity', () => {
  const a = row('a', { quantity: 2 })
  beforeEach(() => useShopping.setState({ status: 'ready', items: [a] }))

  it('is optimistic, rounded and at least 1', async () => {
    mocked.patchShopping.mockResolvedValue(a)
    const p = useShopping.getState().setQuantity(a, 3.6)
    expect(items()[0].quantity).toBe(4)
    await p
    expect(mocked.patchShopping).toHaveBeenCalledWith('a', { quantity: 4 })

    await useShopping.getState().setQuantity(a, 0)
    expect(items()[0].quantity).toBe(1)
  })

  it('rolls back on error', async () => {
    mocked.patchShopping.mockRejectedValue(new Error('no'))
    await expect(useShopping.getState().setQuantity(a, 5)).rejects.toThrow('no')
    expect(items()[0].quantity).toBe(2)
  })
})

describe('remove / clearChecked', () => {
  const a = row('a')
  const b = row('b', { checked: true })
  beforeEach(() => useShopping.setState({ status: 'ready', items: [a, b] }))

  it('remove: optimistic, restored on error', async () => {
    mocked.deleteShopping.mockRejectedValueOnce(new Error('no'))
    await expect(useShopping.getState().remove(a)).rejects.toThrow('no')
    expect(items()).toEqual([a, b])

    mocked.deleteShopping.mockResolvedValue(undefined)
    await useShopping.getState().remove(a)
    expect(items()).toEqual([b])
  })

  it('clearChecked: drops checked rows, restores them on error', async () => {
    mocked.clearCheckedShopping.mockRejectedValueOnce(new Error('no'))
    await expect(useShopping.getState().clearChecked()).rejects.toThrow('no')
    expect(items()).toEqual([a, b])

    mocked.clearCheckedShopping.mockResolvedValue(undefined)
    await useShopping.getState().clearChecked()
    expect(items()).toEqual([a])
  })
})

describe('adding', () => {
  beforeEach(() => useShopping.setState({ status: 'ready', items: [] }))

  it('addText appends the created row', async () => {
    mocked.addShoppingText.mockResolvedValue(row('t', { name: 'Pilas' }))
    await useShopping.getState().addText('Pilas')
    expect(items().map((r) => r.id)).toEqual(['t'])
  })

  it('addProduct appends a new row', async () => {
    const p = product({ id: 'p1' })
    mocked.addShoppingProduct.mockResolvedValue(row('n', { productId: 'p1', product: p, quantity: 2 }))
    await useShopping.getState().addProduct('p1', 2)
    expect(mocked.addShoppingProduct).toHaveBeenCalledWith('p1', 2)
    expect(items().map((r) => r.id)).toEqual(['n'])
    expect(mocked.patchShopping).not.toHaveBeenCalled()
  })

  it('addProduct un-checks a row that was already on the list and ticked', async () => {
    const ticked = row('x', { productId: 'p1', checked: true })
    useShopping.setState({ items: [ticked, row('y')] })
    mocked.addShoppingProduct.mockResolvedValue(ticked)
    mocked.patchShopping.mockResolvedValue({ ...ticked, checked: false })
    await useShopping.getState().addProduct('p1')
    expect(mocked.patchShopping).toHaveBeenCalledWith('x', { checked: false })
    expect(items().map((r) => [r.id, r.checked])).toEqual([
      ['x', false],
      ['y', false],
    ])
  })

  it('addProduct replaces (not duplicates) an existing unchecked row with the server version', async () => {
    useShopping.setState({ items: [row('x', { productId: 'p1', quantity: 1 })] })
    mocked.addShoppingProduct.mockResolvedValue(row('x', { productId: 'p1', quantity: 3 }))
    await useShopping.getState().addProduct('p1', 2)
    expect(items()).toHaveLength(1)
    expect(items()[0].quantity).toBe(3)
  })

  it('addMissing refetches only when something was added', async () => {
    mocked.generateShopping.mockResolvedValueOnce(0)
    await expect(useShopping.getState().addMissing()).resolves.toBe(0)
    expect(mocked.getShopping).not.toHaveBeenCalled()

    mocked.generateShopping.mockResolvedValueOnce(2)
    mocked.getShopping.mockResolvedValue([row('a'), row('b')])
    await expect(useShopping.getState().addMissing()).resolves.toBe(2)
    expect(mocked.getShopping).toHaveBeenCalledTimes(1)
    expect(items()).toHaveLength(2)
  })
})

describe('putAway', () => {
  const pa = product({ id: 'pa', name: 'A' })
  const pb = product({ id: 'pb', name: 'B' })
  const a = row('a', { productId: 'pa', product: pa, quantity: 2, checked: true })
  const b = row('b', { productId: 'pb', product: pb, quantity: 3, checked: true })
  const text = row('t', { name: 'Pilas', checked: true })
  const unchecked = row('u', { productId: 'pu', product: product({ id: 'pu' }), checked: false })

  let adjustProduct: jest.Mock
  beforeEach(() => {
    adjustProduct = jest.fn().mockResolvedValue(1)
    useStock.setState({ adjustProduct })
    mocked.deleteShopping.mockResolvedValue(undefined)
    mocked.clearCheckedShopping.mockResolvedValue(undefined)
  })

  it('stores checked catalog rows in order, then clears the checked ones', async () => {
    useShopping.setState({ status: 'ready', items: [a, unchecked, b, text] })
    const stored = await useShopping.getState().putAway()

    expect(stored).toBe(5)
    expect(adjustProduct.mock.calls).toEqual([
      [pa, 2],
      [pb, 3],
    ])
    expect(mocked.deleteShopping.mock.calls).toEqual([['a'], ['b']])
    expect(mocked.clearCheckedShopping).toHaveBeenCalledTimes(1)
    // the text-only row isn't stored anywhere; it is cleared with the other checked rows
    expect(items().map((r) => r.id)).toEqual(['u'])
  })

  it('drops each row from the list as soon as it is stored, so a mid-way failure cannot double-add', async () => {
    useShopping.setState({ status: 'ready', items: [a, b] })
    adjustProduct.mockResolvedValueOnce(2).mockRejectedValueOnce(new Error('offline'))

    await expect(useShopping.getState().putAway()).rejects.toThrow('offline')
    expect(items().map((r) => r.id)).toEqual(['b']) // a is stored and gone; b is still pending
    expect(mocked.clearCheckedShopping).not.toHaveBeenCalled()

    // retry: only b is processed
    adjustProduct.mockClear().mockResolvedValue(3)
    await expect(useShopping.getState().putAway()).resolves.toBe(3)
    expect(adjustProduct.mock.calls).toEqual([[pb, 3]])
  })

  it('a failure while deleting the list row leaves the row in place', async () => {
    useShopping.setState({ status: 'ready', items: [a] })
    mocked.deleteShopping.mockRejectedValueOnce(new Error('offline'))
    await expect(useShopping.getState().putAway()).rejects.toThrow('offline')
    expect(items().map((r) => r.id)).toEqual(['a'])
  })

  it('returns 0 and does not touch stock when nothing is checked', async () => {
    useShopping.setState({ status: 'ready', items: [unchecked] })
    await expect(useShopping.getState().putAway()).resolves.toBe(0)
    expect(adjustProduct).not.toHaveBeenCalled()
  })

  it('uses the real stock store by default (smoke)', async () => {
    useStock.setState(initialStock, true)
    useStock.setState({ status: 'ready', items: [stockRow({ productId: 'pa', quantity: 1 })] })
    mocked.addStock.mockResolvedValue(3)
    useShopping.setState({ status: 'ready', items: [a] })
    await useShopping.getState().putAway()
    expect(mocked.addStock).toHaveBeenCalledWith('pa', 2)
    expect(useStock.getState().items[0].quantity).toBe(3)
  })
})
