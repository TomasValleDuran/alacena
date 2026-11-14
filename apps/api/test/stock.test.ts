import { describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { api, expectStockShape, makeProduct, NIL_UUID } from './helpers.js'

describe('stock', () => {
  it('GET / returns the pantry with the wire shape', async () => {
    const p = await makeProduct()
    await prisma.stockItem.create({ data: { productId: p.id, quantity: 2.5, minQty: 1 } })
    const res = await api().get('/api/stock')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expectStockShape(res.body[0])
    expect(res.body[0].quantity).toBe(2.5)
  })

  describe('POST /add', () => {
    it('creates the row, adds, and subtracts floored at 0 (row kept)', async () => {
      const p = await makeProduct()
      const add = (delta: number) => api().post('/api/stock/add').send({ productId: p.id, delta })

      let res = await add(3)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ quantity: 3 })
      res = await add(-1.5)
      expect(res.body).toEqual({ quantity: 1.5 })
      res = await add(-10)
      expect(res.body).toEqual({ quantity: 0 })

      const rows = await prisma.stockItem.findMany()
      expect(rows).toHaveLength(1)
      expect(Number(rows[0]!.quantity)).toBe(0)
      expect(Number(rows[0]!.minQty)).toBe(0)
    })

    it('first add with a negative delta creates a 0 row', async () => {
      const p = await makeProduct()
      const res = await api().post('/api/stock/add').send({ productId: p.id, delta: -4 })
      expect(res.body).toEqual({ quantity: 0 })
    })

    it('bumps updatedAt on update and keeps minQty', async () => {
      const p = await makeProduct()
      const old = new Date('2020-01-01T00:00:00Z')
      await prisma.stockItem.create({ data: { productId: p.id, quantity: 1, minQty: 5, updatedAt: old } })
      await api().post('/api/stock/add').send({ productId: p.id, delta: 1 }).expect(200)
      const row = await prisma.stockItem.findFirstOrThrow()
      expect(row.updatedAt.getTime()).toBeGreaterThan(old.getTime())
      expect(Number(row.minQty)).toBe(5)
    })

    it('unknown productId -> 404 (was 500)', async () => {
      const res = await api().post('/api/stock/add').send({ productId: NIL_UUID, delta: 1 })
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Producto no encontrado' })
    })

    it.each([
      [{ productId: 'nope', delta: 1 }],
      [{ delta: 1 }],
      [{ productId: NIL_UUID }],
      [{ productId: NIL_UUID, delta: 'abc' }],
      [{ productId: NIL_UUID, delta: null }],
    ])('invalid body %j -> 400', async (body) => {
      const res = await api().post('/api/stock/add').send(body)
      expect(res.status).toBe(400)
      expect(typeof res.body.error).toBe('string')
    })

    it('10 concurrent adds end at exactly +10', async () => {
      const p = await makeProduct()
      const results = await Promise.all(
        Array.from({ length: 10 }, () => api().post('/api/stock/add').send({ productId: p.id, delta: 1 })),
      )
      expect(results.map((r) => r.status)).toEqual(Array(10).fill(200))
      const row = await prisma.stockItem.findFirstOrThrow()
      expect(Number(row.quantity)).toBe(10)
      expect(await prisma.stockItem.count()).toBe(1)
    })
  })

  describe('PATCH /:id', () => {
    it('sets quantity and minQty', async () => {
      const p = await makeProduct()
      const item = await prisma.stockItem.create({ data: { productId: p.id } })
      const res = await api().patch(`/api/stock/${item.id}`).send({ quantity: 7, minQty: 2 })
      expect(res.status).toBe(200)
      expectStockShape(res.body)
      expect(res.body.quantity).toBe(7)
      expect(res.body.minQty).toBe(2)
    })

    it.each([[{ quantity: 'abc' }], [{ minQty: 'x' }], [{ quantity: -1 }], [{ minQty: {} }]])(
      'non-numeric or negative %j -> 400 (was NaN -> 500)',
      async (body) => {
        const p = await makeProduct()
        const item = await prisma.stockItem.create({ data: { productId: p.id } })
        const res = await api().patch(`/api/stock/${item.id}`).send(body)
        expect(res.status).toBe(400)
      },
    )

    it('unknown id -> 404, non-uuid -> 400', async () => {
      expect((await api().patch(`/api/stock/${NIL_UUID}`).send({ quantity: 1 })).status).toBe(404)
      expect((await api().patch('/api/stock/abc').send({ quantity: 1 })).status).toBe(400)
    })
  })

  describe('DELETE /:id', () => {
    it('deletes (204), then 404; non-uuid 400', async () => {
      const p = await makeProduct()
      const item = await prisma.stockItem.create({ data: { productId: p.id } })
      expect((await api().delete(`/api/stock/${item.id}`)).status).toBe(204)
      expect((await api().delete(`/api/stock/${item.id}`)).status).toBe(404)
      expect((await api().delete('/api/stock/abc')).status).toBe(400)
    })
  })
})
