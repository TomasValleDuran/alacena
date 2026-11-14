import { describe, expect, it, vi } from 'vitest'
import { prisma } from '../src/db.js'
import { api, makeProduct } from './helpers.js'

describe('app', () => {
  it('GET /health', async () => {
    const res = await api().get('/health')
    expect(res.body).toEqual({ ok: true })
  })

  describe('CORS', () => {
    it('allows listed origins', async () => {
      const res = await api().get('/health').set('Origin', 'https://alacena.example')
      expect(res.headers['access-control-allow-origin']).toBe('https://alacena.example')
      const dev = await api().get('/health').set('Origin', 'http://localhost:8081')
      expect(dev.headers['access-control-allow-origin']).toBe('http://localhost:8081')
    })

    it('does not allow other origins', async () => {
      const res = await api().get('/health').set('Origin', 'https://evil.example')
      expect(res.headers['access-control-allow-origin']).toBeUndefined()
      const pre = await api()
        .options('/api/stock')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'GET')
      expect(pre.headers['access-control-allow-origin']).toBeUndefined()
    })

    it('requests without an Origin header work', async () => {
      const res = await api().get('/api/stock')
      expect(res.status).toBe(200)
    })
  })

  describe('error handler', () => {
    it('malformed JSON -> 400', async () => {
      const res = await api().post('/api/shopping').set('Content-Type', 'application/json').send('{"name":')
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'JSON inválido' })
    })

    it('P2002 -> 409', async () => {
      const spy = vi.spyOn(prisma.product, 'upsert').mockRejectedValueOnce(
        Object.assign(new (await import('@prisma/client')).Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        })),
      )
      const res = await api().post('/api/products').send({ barcode: 'a', name: 'b' })
      expect(res.status).toBe(409)
      expect(typeof res.body.error).toBe('string')
      spy.mockRestore()
    })

    it('P2003 -> 404 Producto no encontrado', async () => {
      const { Prisma } = await import('@prisma/client')
      const p = await makeProduct()
      const spy = vi.spyOn(prisma.shoppingItem, 'create').mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'x' }),
      )
      const res = await api().post('/api/shopping').send({ productId: p.id })
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Producto no encontrado' })
      spy.mockRestore()
    })

    it('unknown errors -> generic 500 that never leaks the message', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      const spy = vi.spyOn(prisma.stockItem, 'findMany').mockRejectedValueOnce(new Error('secret db password'))
      const res = await api().get('/api/stock')
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'Algo salió mal' })
      expect(JSON.stringify(res.body)).not.toContain('secret')
      expect(log).toHaveBeenCalled()
      spy.mockRestore()
      log.mockRestore()
    })
  })
})
