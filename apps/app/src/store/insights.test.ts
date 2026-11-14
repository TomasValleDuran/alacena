import { api } from '@/lib/api'
import { deferred } from '@/test-utils/mock-api'
import { product, stockRow } from '@/test-utils/factories'
import type { Insights } from '@/lib/types'

import { useInsights } from './insights'
import { useStock } from './stock'

jest.mock('@/lib/api', () => jest.requireActual('@/test-utils/mock-api').mockApiModule())

const mocked = api as jest.Mocked<typeof api>
const initial = useInsights.getState()
const initialStock = useStock.getState()

const insights = (p = product()): Insights => ({ product: p, prices: null })
const FIVE_MIN = 5 * 60 * 1000

let now = 1_000_000
beforeEach(() => {
  jest.resetAllMocks()
  now = 1_000_000
  jest.spyOn(Date, 'now').mockImplementation(() => now)
  useInsights.setState(initial, true)
  useStock.setState(initialStock, true)
})
afterEach(() => jest.restoreAllMocks())

it('loads once and stores the result with its timestamp', async () => {
  mocked.getInsights.mockResolvedValue(insights())
  const p = useInsights.getState().load('p1')
  expect(useInsights.getState().byProduct.p1).toEqual({ status: 'loading' })
  await p
  expect(useInsights.getState().byProduct.p1).toMatchObject({ status: 'ready', at: now })
})

it('reuses data younger than 5 minutes and refetches after', async () => {
  mocked.getInsights.mockResolvedValue(insights())
  await useInsights.getState().load('p1')

  now += FIVE_MIN - 1
  await useInsights.getState().load('p1')
  expect(mocked.getInsights).toHaveBeenCalledTimes(1)

  now += 1
  await useInsights.getState().load('p1')
  expect(mocked.getInsights).toHaveBeenCalledTimes(2)
})

it('force bypasses freshness', async () => {
  mocked.getInsights.mockResolvedValue(insights())
  await useInsights.getState().load('p1')
  await useInsights.getState().load('p1', { force: true })
  expect(mocked.getInsights).toHaveBeenCalledTimes(2)
})

it('de-dupes concurrent loads of the same product, even forced ones', async () => {
  const d = deferred<Insights>()
  mocked.getInsights.mockReturnValue(d.promise)
  const a = useInsights.getState().load('p1')
  const b = useInsights.getState().load('p1')
  const c = useInsights.getState().load('p1', { force: true })
  d.resolve(insights())
  await Promise.all([a, b, c])
  expect(mocked.getInsights).toHaveBeenCalledTimes(1)
})

it('different products load independently', async () => {
  mocked.getInsights.mockImplementation(async (id) => insights(product({ id })))
  await Promise.all([useInsights.getState().load('a'), useInsights.getState().load('b')])
  expect(mocked.getInsights).toHaveBeenCalledTimes(2)
})

it('records an error, and the next load retries', async () => {
  mocked.getInsights.mockRejectedValueOnce(new Error('pricely down'))
  await useInsights.getState().load('p1')
  expect(useInsights.getState().byProduct.p1).toEqual({ status: 'error', error: 'pricely down' })

  mocked.getInsights.mockResolvedValue(insights())
  await useInsights.getState().load('p1')
  expect(useInsights.getState().byProduct.p1.status).toBe('ready')
})

it('pushes the refreshed product (categories, image…) into the pantry rows', async () => {
  const row = stockRow({ productId: 'p1', product: { name: 'Leche' } })
  const other = stockRow({ productId: 'p2' })
  useStock.setState({ status: 'ready', items: [row, other] })
  const fresh = product({ id: 'p1', name: 'Leche', categories: ['lacteos'] })
  mocked.getInsights.mockResolvedValue(insights(fresh))

  await useInsights.getState().load('p1')
  const items = useStock.getState().items
  expect(items[0].product.categories).toEqual(['lacteos'])
  expect(items[1]).toBe(other)
})
