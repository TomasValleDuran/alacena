import { describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { api, expectShoppingShape, makeProduct, NIL_UUID } from './helpers.js'

describe('shopping', () => {
  it('GET / lists items oldest first with the wire shape', async () => {
    const p = await makeProduct()
    await prisma.shoppingItem.create({ data: { name: 'Pan' } })
    await prisma.shoppingItem.create({ data: { productId: p.id, quantity: 2 } })
    const res = await api().get('/api/shopping')
    expect(res.status).toBe(200)
    expect(res.body.map((i: { name: string | null }) => i.name)).toEqual(['Pan', null])
    res.body.forEach(expectShoppingShape)
    expect(res.body[0].product).toBeNull()
    expect(res.body[1].product.id).toBe(p.id)
  })

  describe('POST /', () => {
    it('free text -> 201', async () => {
      const res = await api().post('/api/shopping').send({ name: '  Pan  ', quantity: 3 })
      expect(res.status).toBe(201)
      expectShoppingShape(res.body)
      expect(res.body).toMatchObject({ name: 'Pan', quantity: 3, checked: false, productId: null })
    })

    it('product -> 201, then 200 with the same row', async () => {
      const p = await makeProduct()
      const a = await api().post('/api/shopping').send({ productId: p.id })
      expect(a.status).toBe(201)
      expect(a.body.quantity).toBe(1)
      expect(a.body.product.id).toBe(p.id)
      const b = await api().post('/api/shopping').send({ productId: p.id, quantity: 5 })
      expect(b.status).toBe(200)
      expect(b.body.id).toBe(a.body.id)
      expect(b.body.quantity).toBe(1)
    })

    it('unknown product -> 404; bad ids and missing name -> 400', async () => {
      expect((await api().post('/api/shopping').send({ productId: NIL_UUID })).status).toBe(404)
      expect((await api().post('/api/shopping').send({ productId: 'abc' })).status).toBe(400)
      const res = await api().post('/api/shopping').send({})
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'Nombre requerido' })
      expect((await api().post('/api/shopping').send({ name: '   ' })).status).toBe(400)
    })

    it('quantity is rounded to an integer >= 1, same as PATCH', async () => {
      const a = await api().post('/api/shopping').send({ name: 'a', quantity: 2.6 })
      expect(a.body.quantity).toBe(3)
      const b = await api().post('/api/shopping').send({ name: 'b', quantity: 0 })
      expect(b.body.quantity).toBe(1)
      const c = await api().post('/api/shopping').send({ name: 'c', quantity: 'abc' })
      expect(c.status).toBe(400)
    })

    it('5 simultaneous identical posts -> one row, no 500', async () => {
      const p = await makeProduct()
      const results = await Promise.all(
        Array.from({ length: 5 }, () => api().post('/api/shopping').send({ productId: p.id })),
      )
      for (const r of results) expect([200, 201]).toContain(r.status)
      expect(results.filter((r) => r.status === 201)).toHaveLength(1)
      expect(new Set(results.map((r) => r.body.id)).size).toBe(1)
      expect(await prisma.shoppingItem.count()).toBe(1)
    })
  })

  describe('POST /generate', () => {
    it('adds low-stock products not already listed', async () => {
      const [a, b, c, d] = await Promise.all([makeProduct(), makeProduct(), makeProduct(), makeProduct()])
      await prisma.stockItem.createMany({
        data: [
          { productId: a.id, quantity: 0, minQty: 0 }, // out of stock -> 1
          { productId: b.id, quantity: 1, minQty: 4 }, // low -> 3
          { productId: c.id, quantity: 9, minQty: 4 }, // fine
          { productId: d.id, quantity: 0, minQty: 0 }, // already listed
        ],
      })
      await prisma.shoppingItem.create({ data: { productId: d.id } })
      const res = await api().post('/api/shopping/generate')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ added: 2 })
      const rows = await prisma.shoppingItem.findMany({ where: { productId: { in: [a.id, b.id] } } })
      const byProduct = Object.fromEntries(rows.map((r) => [r.productId, Number(r.quantity)]))
      expect(byProduct).toEqual({ [a.id]: 1, [b.id]: 3 })
    })

    it('empty pantry -> { added: 0 }', async () => {
      expect((await api().post('/api/shopping/generate')).body).toEqual({ added: 0 })
    })

    it('concurrent generates never duplicate or 500', async () => {
      const ps = await Promise.all([makeProduct(), makeProduct(), makeProduct()])
      await prisma.stockItem.createMany({ data: ps.map((p) => ({ productId: p.id, quantity: 0 })) })
      const results = await Promise.all(Array.from({ length: 4 }, () => api().post('/api/shopping/generate')))
      for (const r of results) expect(r.status).toBe(200)
      const total = results.reduce((n, r) => n + r.body.added, 0)
      expect(total).toBe(3)
      expect(await prisma.shoppingItem.count()).toBe(3)
    })
  })

  describe('PATCH /:id', () => {
    it('updates quantity (rounded, >= 1) and checked', async () => {
      const item = await prisma.shoppingItem.create({ data: { name: 'Pan' } })
      const res = await api().patch(`/api/shopping/${item.id}`).send({ quantity: 2.4, checked: true })
      expect(res.status).toBe(200)
      expectShoppingShape(res.body)
      expect(res.body).toMatchObject({ quantity: 2, checked: true })
      const low = await api().patch(`/api/shopping/${item.id}`).send({ quantity: -3 })
      expect(low.body.quantity).toBe(1)
    })

    it('checked "false" is not truthy (was Boolean("false") === true)', async () => {
      const item = await prisma.shoppingItem.create({ data: { name: 'Pan', checked: true } })
      const res = await api().patch(`/api/shopping/${item.id}`).send({ checked: 'false' })
      expect(res.status).toBe(400)
      expect((await prisma.shoppingItem.findFirstOrThrow()).checked).toBe(true)
      const ok = await api().patch(`/api/shopping/${item.id}`).send({ checked: false })
      expect(ok.body.checked).toBe(false)
    })

    it('unknown id -> 404, non-uuid -> 400, bad quantity -> 400', async () => {
      expect((await api().patch(`/api/shopping/${NIL_UUID}`).send({ checked: true })).status).toBe(404)
      expect((await api().patch('/api/shopping/abc').send({ checked: true })).status).toBe(400)
      const item = await prisma.shoppingItem.create({ data: { name: 'Pan' } })
      expect((await api().patch(`/api/shopping/${item.id}`).send({ quantity: 'abc' })).status).toBe(400)
    })
  })

  describe('DELETE', () => {
    it('/checked removes only checked rows', async () => {
      await prisma.shoppingItem.create({ data: { name: 'a', checked: true } })
      await prisma.shoppingItem.create({ data: { name: 'b' } })
      const res = await api().delete('/api/shopping/checked')
      expect(res.status).toBe(204)
      expect((await prisma.shoppingItem.findMany()).map((i) => i.name)).toEqual(['b'])
    })

    it('/:id deletes, then 404; non-uuid 400', async () => {
      const item = await prisma.shoppingItem.create({ data: { name: 'a' } })
      expect((await api().delete(`/api/shopping/${item.id}`)).status).toBe(204)
      expect((await api().delete(`/api/shopping/${item.id}`)).status).toBe(404)
      expect((await api().delete('/api/shopping/abc')).status).toBe(400)
    })
  })
})
