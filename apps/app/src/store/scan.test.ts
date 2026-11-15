import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'

import { api, ApiError } from '@/lib/api'
import { deferred, flush } from '@/test-utils/mock-api'
import { product } from '@/test-utils/factories'

import { useScan } from './scan'
import { useStock } from './stock'

jest.mock('@/lib/api', () => jest.requireActual('@/test-utils/mock-api').mockApiModule())

const mocked = api as jest.Mocked<typeof api>
const haptics = Haptics as jest.Mocked<typeof Haptics>
const initialScan = useScan.getState()
const initialStock = useStock.getState()

// valid EAN-13s (see tools/fixtures/barcodes.json)
const A = '7790070410122'
const B = '5901234123457'
const BAD = '7790070410123'

const milk = product({ id: 'milk', name: 'Leche', barcode: A })
const rice = product({ id: 'rice', name: 'Arroz', barcode: B })

let adjustProduct: jest.Mock
let stockFetch: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  jest.resetAllMocks()
  haptics.notificationAsync.mockResolvedValue(undefined)
  haptics.impactAsync.mockResolvedValue(undefined)
  haptics.selectionAsync.mockResolvedValue(undefined)
  useScan.setState(initialScan, true)
  useStock.setState(initialStock, true)
  adjustProduct = jest.fn(async (_p, delta: number) => Math.max(0, 5 + delta))
  stockFetch = jest.fn().mockResolvedValue(undefined)
  useStock.setState({ adjustProduct, fetch: stockFetch })
})

afterEach(async () => {
  // never leave a paused queue behind: the queue is module state
  useScan.getState().cancelPending()
  await flush()
})

const log = () => useScan.getState().log

describe('settings', () => {
  it('setPerScan rounds and clamps to 1..99', () => {
    const { setPerScan } = useScan.getState()
    setPerScan(0)
    expect(useScan.getState().perScan).toBe(1)
    setPerScan(2.6)
    expect(useScan.getState().perScan).toBe(3)
    setPerScan(500)
    expect(useScan.getState().perScan).toBe(99)
  })

  it('setMode clears the consulted product and any notice', () => {
    useScan.setState({ checked: milk, notice: { key: 1, tone: 'error', text: 'x' } })
    useScan.getState().setMode('use')
    expect(useScan.getState()).toMatchObject({ mode: 'use', checked: null, notice: null })
  })
})

describe('submit: validation', () => {
  it('ignores codes shorter than 4 characters', async () => {
    useScan.getState().submit('123', 'manual')
    await flush()
    expect(mocked.resolveProduct).not.toHaveBeenCalled()
    expect(useScan.getState().notice).toBeNull()
  })

  it('tells typed codes with a bad check digit why, without looking them up', async () => {
    useScan.getState().submit(BAD, 'manual')
    await flush()
    expect(mocked.resolveProduct).not.toHaveBeenCalled()
    expect(useScan.getState().notice).toMatchObject({
      tone: 'error',
      text: `${BAD} no es un código válido. Revisá los números.`,
    })
    expect(haptics.notificationAsync).toHaveBeenCalledWith('error')
  })

  it('silently ignores a bad read from the camera', async () => {
    useScan.getState().submit(BAD, 'camera')
    await flush()
    expect(mocked.resolveProduct).not.toHaveBeenCalled()
    expect(useScan.getState().notice).toBeNull()
    expect(haptics.notificationAsync).not.toHaveBeenCalled()
  })

  it('trims the code before looking it up', async () => {
    mocked.resolveProduct.mockResolvedValue(milk)
    useScan.getState().submit(`  ${A}\n`, 'camera')
    await flush()
    expect(mocked.resolveProduct).toHaveBeenCalledWith(A)
  })

  it.each(['camera', 'manual'] as const)('%s: a UPC-A in its 13-digit form is looked up as 12 digits', async (source) => {
    mocked.resolveProduct.mockResolvedValue(milk)
    useScan.getState().submit(' 0036000291452 ', source)
    await flush()
    expect(mocked.resolveProduct).toHaveBeenCalledWith('036000291452')
  })

  it('a typed 0-prefixed 13-digit code with a bad check digit is reported in its 12-digit form', async () => {
    useScan.getState().submit('0036000291453', 'manual')
    await flush()
    expect(mocked.resolveProduct).not.toHaveBeenCalled()
    expect(useScan.getState().notice?.text).toBe('036000291453 no es un código válido. Revisá los números.')
  })
})

describe('modes', () => {
  beforeEach(() => mocked.resolveProduct.mockResolvedValue(milk))

  it('add: +perScan, logs the new total, success haptic', async () => {
    useScan.getState().setPerScan(3)
    useScan.getState().submit(A, 'camera')
    await flush()
    expect(adjustProduct).toHaveBeenCalledWith(milk, 3)
    expect(log()).toHaveLength(1)
    expect(log()[0]).toMatchObject({ product: milk, delta: 3, total: 8, undone: false })
    expect(haptics.notificationAsync).toHaveBeenCalledWith('success')
    expect(useScan.getState().busy).toBeNull()
  })

  it('use: -perScan; hitting zero warns instead of celebrating', async () => {
    useScan.getState().setMode('use')
    adjustProduct.mockResolvedValueOnce(2)
    useScan.getState().submit(A, 'camera')
    await flush()
    expect(adjustProduct).toHaveBeenLastCalledWith(milk, -1)
    expect(haptics.notificationAsync).toHaveBeenLastCalledWith('success')

    adjustProduct.mockResolvedValueOnce(0)
    mocked.resolveProduct.mockResolvedValueOnce(rice)
    useScan.getState().submit(B, 'camera')
    await flush()
    expect(adjustProduct).toHaveBeenLastCalledWith(rice, -1)
    expect(haptics.notificationAsync).toHaveBeenLastCalledWith('warning')
  })

  it('add reaching a total of 0 is not a warning (only "use" is)', async () => {
    adjustProduct.mockResolvedValueOnce(0)
    useScan.getState().submit(A, 'camera')
    await flush()
    expect(haptics.notificationAsync).toHaveBeenLastCalledWith('success')
  })

  it('check: no stock change, refreshes the pantry quietly and shows the product', async () => {
    useScan.getState().setMode('check')
    useScan.getState().submit(A, 'camera')
    await flush()
    expect(adjustProduct).not.toHaveBeenCalled()
    expect(stockFetch).toHaveBeenCalledWith({ silent: true })
    expect(useScan.getState().checked).toBe(milk)
    expect(log()).toEqual([])
    expect(haptics.impactAsync).toHaveBeenCalled()
  })

  it('keeps only the latest 50 log entries', async () => {
    for (let i = 0; i < 52; i++) {
      useScan.getState().submit(A, 'camera')
      await flush()
    }
    expect(log()).toHaveLength(50)
  })

  it('a successful add clears an earlier error notice', async () => {
    useScan.setState({ notice: { key: 1, tone: 'error', text: 'x' } })
    useScan.getState().submit(A, 'camera')
    await flush()
    expect(useScan.getState().notice).toBeNull()
  })
})

describe('queue', () => {
  it('handles codes one at a time, in order', async () => {
    const first = deferred<typeof milk | null>()
    mocked.resolveProduct.mockReturnValueOnce(first.promise).mockResolvedValueOnce(rice)

    useScan.getState().submit(A, 'camera')
    useScan.getState().submit(B, 'camera')
    await flush()
    expect(mocked.resolveProduct).toHaveBeenCalledTimes(1)
    expect(useScan.getState().busy).toBe(A)

    first.resolve(milk)
    await flush()
    expect(mocked.resolveProduct.mock.calls.map((c) => c[0])).toEqual([A, B])
    expect(adjustProduct.mock.calls.map((c) => c[0])).toEqual([milk, rice])
    expect(log().map((e) => e.product.id)).toEqual(['rice', 'milk']) // newest first
  })

  it('an error reports a notice and the queue keeps going', async () => {
    mocked.resolveProduct
      .mockRejectedValueOnce(new ApiError('No hay conexión con el servidor.', null))
      .mockResolvedValueOnce(rice)
    useScan.getState().submit(A, 'camera')
    useScan.getState().submit(B, 'camera')
    await flush()
    expect(haptics.notificationAsync).toHaveBeenCalledWith('error')
    expect(adjustProduct).toHaveBeenCalledTimes(1)
    expect(useScan.getState().busy).toBeNull()
    // the later success clears the earlier notice
    expect(log()).toHaveLength(1)
  })

  it('keeps the error notice when it is the last thing that happened', async () => {
    mocked.resolveProduct.mockRejectedValue(new Error('boom'))
    useScan.getState().submit(A, 'camera')
    await flush()
    expect(useScan.getState().notice).toMatchObject({ tone: 'error', text: 'boom' })
  })
})

describe('new product (unknown code)', () => {
  beforeEach(() => mocked.resolveProduct.mockResolvedValueOnce(null))

  it('sets pending and opens the new-product sheet', async () => {
    useScan.getState().submit(A, 'camera')
    await flush()
    expect(useScan.getState().pending).toBe(A)
    expect(router.push).toHaveBeenCalledWith({ pathname: '/new-product', params: { barcode: A } })
    expect(haptics.notificationAsync).toHaveBeenCalledWith('warning')
  })

  it('pauses the queue while pending, resumes on completePending', async () => {
    mocked.resolveProduct.mockResolvedValueOnce(rice)
    useScan.getState().submit(A, 'camera')
    useScan.getState().submit(B, 'camera')
    await flush()
    expect(mocked.resolveProduct).toHaveBeenCalledTimes(1) // B is waiting

    await useScan.getState().completePending(milk)
    await flush()
    expect(adjustProduct.mock.calls.map((c) => c[0])).toEqual([milk, rice])
    expect(useScan.getState().pending).toBeNull()
  })

  it('resumes on cancelPending without applying anything', async () => {
    mocked.resolveProduct.mockResolvedValueOnce(rice)
    useScan.getState().submit(A, 'camera')
    useScan.getState().submit(B, 'camera')
    await flush()

    useScan.getState().cancelPending()
    await flush()
    expect(adjustProduct.mock.calls.map((c) => c[0])).toEqual([rice])
    expect(useScan.getState().pending).toBeNull()
  })

  it('cancelPending with nothing pending is a no-op', () => {
    useScan.getState().cancelPending()
    expect(useScan.getState().pending).toBeNull()
  })

  it('completePending clears pending even if applying fails', async () => {
    useScan.getState().submit(A, 'camera')
    await flush()
    adjustProduct.mockRejectedValueOnce(new Error('no'))
    await expect(useScan.getState().completePending(milk)).rejects.toThrow('no')
    expect(useScan.getState().pending).toBeNull()
  })
})

describe('undo', () => {
  beforeEach(async () => {
    mocked.resolveProduct.mockResolvedValue(milk)
    useScan.getState().setPerScan(2)
    useScan.getState().submit(A, 'camera')
    await flush()
    adjustProduct.mockClear()
  })

  it('reverts the delta and marks the entry undone', async () => {
    const { key } = log()[0]
    await useScan.getState().undo(key)
    expect(adjustProduct).toHaveBeenCalledWith(milk, -2)
    expect(log()[0].undone).toBe(true)
    expect(haptics.selectionAsync).toHaveBeenCalled()
  })

  it('marks it undone immediately (before the server answers)', async () => {
    const d = deferred<number>()
    adjustProduct.mockReturnValueOnce(d.promise)
    const p = useScan.getState().undo(log()[0].key)
    expect(log()[0].undone).toBe(true)
    d.resolve(3)
    await p
  })

  it('cannot be undone twice', async () => {
    const { key } = log()[0]
    await useScan.getState().undo(key)
    await useScan.getState().undo(key)
    expect(adjustProduct).toHaveBeenCalledTimes(1)
  })

  it('ignores unknown keys', async () => {
    await useScan.getState().undo(12345)
    expect(adjustProduct).not.toHaveBeenCalled()
  })

  it('on failure restores the entry and shows an error', async () => {
    adjustProduct.mockRejectedValueOnce(new Error('offline'))
    await useScan.getState().undo(log()[0].key)
    expect(log()[0].undone).toBe(false)
    expect(useScan.getState().notice).toMatchObject({ tone: 'error', text: 'offline' })
  })

  it('undoing a "use" scan adds the units back', async () => {
    useScan.getState().setMode('use')
    useScan.getState().submit(A, 'camera')
    await flush()
    adjustProduct.mockClear()
    await useScan.getState().undo(log()[0].key)
    expect(adjustProduct).toHaveBeenCalledWith(milk, 2)
  })
})

describe('session', () => {
  it('clearSession empties the log, consulted product and notice; dismissNotice clears the notice', () => {
    useScan.setState({ log: [{ key: 1, product: milk, delta: 1, total: 1, undone: false }], checked: milk })
    useScan.setState({ notice: { key: 2, tone: 'info', text: 'x' } })
    useScan.getState().dismissNotice()
    expect(useScan.getState().notice).toBeNull()
    useScan.getState().clearSession()
    expect(useScan.getState()).toMatchObject({ log: [], checked: null, notice: null })
  })
})
