import { api, ApiError } from '@/lib/api'
import { deferred, flush } from '@/test-utils/mock-api'
import { product, stockRow } from '@/test-utils/factories'

import { useStock } from './stock'

jest.mock('@/lib/api', () => jest.requireActual('@/test-utils/mock-api').mockApiModule())

const mocked = api as jest.Mocked<typeof api>
const initial = useStock.getState()

const qty = (id: string) => useStock.getState().items.find((r) => r.id === id)?.quantity

beforeEach(() => {
  jest.resetAllMocks()
  useStock.setState(initial, true)
})

describe('fetch', () => {
  it('first load shows loading, then ready with the items', async () => {
    const d = deferred<ReturnType<typeof stockRow>[]>()
    mocked.getStock.mockReturnValue(d.promise)
    const p = useStock.getState().fetch()
    expect(useStock.getState()).toMatchObject({ status: 'loading', error: null })
    d.resolve([stockRow()])
    await p
    expect(useStock.getState()).toMatchObject({ status: 'ready', refreshing: false })
    expect(useStock.getState().items).toHaveLength(1)
  })

  it('later refetches keep status ready and only flag refreshing', async () => {
    useStock.setState({ status: 'ready', items: [stockRow()] })
    const d = deferred<ReturnType<typeof stockRow>[]>()
    mocked.getStock.mockReturnValue(d.promise)
    const p = useStock.getState().fetch()
    expect(useStock.getState()).toMatchObject({ status: 'ready', refreshing: true })
    d.resolve([])
    await p
    expect(useStock.getState()).toMatchObject({ status: 'ready', refreshing: false, items: [] })
  })

  it('silent refetches do not flag refreshing', async () => {
    useStock.setState({ status: 'ready' })
    const d = deferred<ReturnType<typeof stockRow>[]>()
    mocked.getStock.mockReturnValue(d.promise)
    const p = useStock.getState().fetch({ silent: true })
    expect(useStock.getState().refreshing).toBe(false)
    d.resolve([])
    await p
  })

  it('a silent fetch before the first load does nothing', async () => {
    await useStock.getState().fetch({ silent: true })
    expect(mocked.getStock).not.toHaveBeenCalled()
    expect(useStock.getState().status).toBe('idle')
  })

  it('an unexpected server answer is an error state, never items: null', async () => {
    mocked.getStock.mockRejectedValue(new ApiError('El servidor respondió algo inesperado. Revisá la dirección en Ajustes.', 200))
    await useStock.getState().fetch()
    expect(useStock.getState()).toMatchObject({ status: 'error', items: [] })
  })

  it('a failed first load becomes the error state', async () => {
    mocked.getStock.mockRejectedValue(new ApiError('No hay conexión con el servidor.', null))
    await useStock.getState().fetch()
    expect(useStock.getState()).toMatchObject({ status: 'error', error: 'No hay conexión con el servidor.' })
  })

  it('a failed refresh keeps the last good data and reports the error; a silent one stays quiet', async () => {
    const rows = [stockRow()]
    useStock.setState({ status: 'ready', items: rows })
    mocked.getStock.mockRejectedValue(new Error('boom'))
    await useStock.getState().fetch()
    expect(useStock.getState()).toMatchObject({ status: 'ready', error: 'boom', refreshing: false, items: rows })

    useStock.setState({ error: null })
    await useStock.getState().fetch({ silent: true })
    expect(useStock.getState().error).toBeNull()
  })
})

describe('adjust (stepper)', () => {
  const row = stockRow({ quantity: 3 })
  beforeEach(() => useStock.setState({ status: 'ready', items: [row] }))

  it('updates the quantity optimistically, then takes the server total', async () => {
    const d = deferred<number>()
    mocked.addStock.mockReturnValue(d.promise)
    const p = useStock.getState().adjust(row, 1)
    expect(qty(row.id)).toBe(4)
    expect(mocked.addStock).toHaveBeenCalledWith(row.productId, 1)
    d.resolve(7) // someone else also added: server total wins
    await p
    expect(qty(row.id)).toBe(7)
  })

  it('never goes below zero, and sends only the real delta', async () => {
    mocked.addStock.mockResolvedValue(0)
    await useStock.getState().adjust(row, -10)
    expect(mocked.addStock).toHaveBeenCalledWith(row.productId, -3)
    expect(qty(row.id)).toBe(0)
  })

  it('does nothing (no request) when the quantity would not change', async () => {
    useStock.setState({ items: [{ ...row, quantity: 0 }] })
    await useStock.getState().adjust(row, -1)
    expect(mocked.addStock).not.toHaveBeenCalled()
  })

  it('ignores rows that are no longer in the store', async () => {
    useStock.setState({ items: [] })
    await useStock.getState().adjust(row, 1)
    expect(mocked.addStock).not.toHaveBeenCalled()
  })

  it('with fast taps only the last reply overwrites the optimistic value', async () => {
    const first = deferred<number>()
    const second = deferred<number>()
    mocked.addStock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const p1 = useStock.getState().adjust(row, 1)
    const p2 = useStock.getState().adjust(row, 1)
    expect(qty(row.id)).toBe(5)

    first.resolve(4) // stale: would make the number bounce back
    await p1
    expect(qty(row.id)).toBe(5)

    second.resolve(5)
    await p2
    expect(qty(row.id)).toBe(5)
    second.promise.catch(() => {})
  })

  it('a stale reply arriving after the last one is also ignored', async () => {
    const first = deferred<number>()
    const second = deferred<number>()
    mocked.addStock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const p1 = useStock.getState().adjust(row, 1)
    const p2 = useStock.getState().adjust(row, 1)
    second.resolve(5)
    await p2
    expect(qty(row.id)).toBe(5)
    first.resolve(4)
    await p1
    expect(qty(row.id)).toBe(5)
  })

  it('on error, rolls back by refetching the real state, and rethrows', async () => {
    mocked.addStock.mockRejectedValue(new Error('offline'))
    mocked.getStock.mockResolvedValue([row])
    await expect(useStock.getState().adjust(row, 1)).rejects.toThrow('offline')
    expect(mocked.getStock).toHaveBeenCalledTimes(1)
    expect(qty(row.id)).toBe(3)
  })

  it('does not refetch on error while a newer tap is still in flight', async () => {
    const first = deferred<number>()
    const second = deferred<number>()
    mocked.addStock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const p1 = useStock.getState().adjust(row, 1)
    const p2 = useStock.getState().adjust(row, 1)
    first.reject(new Error('offline'))
    await expect(p1).rejects.toThrow('offline')
    expect(mocked.getStock).not.toHaveBeenCalled()
    second.resolve(5)
    await p2
    expect(qty(row.id)).toBe(5)
  })
})

describe('adjustProduct (scanner)', () => {
  it('updates an existing row with the server total and returns it', async () => {
    const row = stockRow({ quantity: 1 })
    useStock.setState({ status: 'ready', items: [row] })
    mocked.addStock.mockResolvedValue(3)
    await expect(useStock.getState().adjustProduct(row.product, 2)).resolves.toBe(3)
    expect(mocked.addStock).toHaveBeenCalledWith(row.product.id, 2)
    expect(qty(row.id)).toBe(3)
    expect(mocked.getStock).not.toHaveBeenCalled()
  })

  it('refetches quietly when the product is new to the pantry', async () => {
    const p = product({ id: 'new' })
    useStock.setState({ status: 'ready', items: [] })
    mocked.addStock.mockResolvedValue(1)
    mocked.getStock.mockResolvedValue([stockRow({ productId: 'new', quantity: 1 })])
    await expect(useStock.getState().adjustProduct(p, 1)).resolves.toBe(1)
    expect(useStock.getState().items).toHaveLength(1)
    expect(useStock.getState().refreshing).toBe(false)
  })

  it('propagates errors without touching the store', async () => {
    const row = stockRow({ quantity: 1 })
    useStock.setState({ status: 'ready', items: [row] })
    mocked.addStock.mockRejectedValue(new Error('no'))
    await expect(useStock.getState().adjustProduct(row.product, 1)).rejects.toThrow('no')
    expect(qty(row.id)).toBe(1)
  })
})

describe('setMinQty', () => {
  const row = stockRow({ minQty: 2 })
  beforeEach(() => useStock.setState({ status: 'ready', items: [row] }))

  it('is optimistic', async () => {
    const d = deferred<ReturnType<typeof stockRow>>()
    mocked.patchStock.mockReturnValue(d.promise)
    const p = useStock.getState().setMinQty(row, 5)
    expect(useStock.getState().items[0].minQty).toBe(5)
    d.resolve(row)
    await p
    expect(mocked.patchStock).toHaveBeenCalledWith(row.id, { minQty: 5 })
  })

  it('rolls back and rethrows on error', async () => {
    mocked.patchStock.mockRejectedValue(new Error('no'))
    await expect(useStock.getState().setMinQty(row, 5)).rejects.toThrow('no')
    expect(useStock.getState().items[0].minQty).toBe(2)
  })
})

describe('remove', () => {
  const a = stockRow({ productId: 'a' })
  const b = stockRow({ productId: 'b' })
  beforeEach(() => useStock.setState({ status: 'ready', items: [a, b] }))

  it('removes immediately', async () => {
    mocked.deleteStock.mockResolvedValue(undefined)
    const p = useStock.getState().remove(a)
    expect(useStock.getState().items).toEqual([b])
    await p
    expect(mocked.deleteStock).toHaveBeenCalledWith(a.id)
  })

  it('puts the row back on error', async () => {
    mocked.deleteStock.mockRejectedValue(new Error('no'))
    await expect(useStock.getState().remove(a)).rejects.toThrow('no')
    expect(useStock.getState().items).toEqual([a, b])
    await flush()
  })
})
