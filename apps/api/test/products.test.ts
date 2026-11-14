import { describe, expect, it, vi } from 'vitest'
import { prisma } from '../src/db.js'
import { lookupPricely, pricelyCategories, pricelyInsights } from '../src/lib/pricely.js'
import { lookupBarcode } from '../src/lib/openFoodFacts.js'
import { api, expectProductShape, makeProduct, NIL_UUID } from './helpers.js'

const GOOD_EAN = '7790070410122' // valid check digit

describe('products', () => {
  describe('POST /resolve', () => {
    it('returns a cached product without lookups', async () => {
      const p = await makeProduct({ barcode: GOOD_EAN })
      const res = await api().post('/api/products/resolve').send({ barcode: GOOD_EAN })
      expect(res.status).toBe(200)
      expectProductShape(res.body.product)
      expect(res.body.product.id).toBe(p.id)
      expect(lookupPricely).not.toHaveBeenCalled()
    })

    it('pricely hit is stored; OFF is the fallback', async () => {
      vi.mocked(lookupPricely).mockResolvedValueOnce({ barcode: GOOD_EAN, name: 'Yerba', categories: ['almacen'] })
      const a = await api().post('/api/products/resolve').send({ barcode: ` ${GOOD_EAN} ` })
      expect(a.status).toBe(200)
      expect(a.body.product).toMatchObject({ barcode: GOOD_EAN, name: 'Yerba', categories: ['almacen'] })
      expect(lookupBarcode).not.toHaveBeenCalled()

      await prisma.product.deleteMany()
      vi.mocked(lookupBarcode).mockResolvedValueOnce({ barcode: GOOD_EAN, name: 'Off name', brand: 'B' })
      const b = await api().post('/api/products/resolve').send({ barcode: GOOD_EAN })
      expect(b.body.product).toMatchObject({ name: 'Off name', brand: 'B' })
    })

    it('unknown code -> 404 {found:false}', async () => {
      const res = await api().post('/api/products/resolve').send({ barcode: GOOD_EAN })
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ found: false })
    })

    it('short/missing -> 400, bad check digit -> 422', async () => {
      expect((await api().post('/api/products/resolve').send({ barcode: '12' })).status).toBe(400)
      expect((await api().post('/api/products/resolve').send({})).body).toEqual({ error: 'Código inválido' })
      const res = await api().post('/api/products/resolve').send({ barcode: '7790070410121' })
      expect(res.status).toBe(422)
      expect(typeof res.body.error).toBe('string')
    })
  })

  describe('POST /', () => {
    it('creates (201) and does not clobber an existing barcode', async () => {
      const a = await api().post('/api/products').send({ barcode: 'abc123', name: ' Pan ', brand: ' Bimbo ' })
      expect(a.status).toBe(201)
      expectProductShape(a.body.product)
      expect(a.body.product).toMatchObject({ barcode: 'abc123', name: 'Pan', brand: 'Bimbo' })
      const b = await api().post('/api/products').send({ barcode: 'abc123', name: 'Otro' })
      expect(b.body.product.id).toBe(a.body.product.id)
      expect(b.body.product.name).toBe('Pan')
    })

    it('blank brand -> null; missing fields -> 400', async () => {
      const a = await api().post('/api/products').send({ barcode: 'x1', name: 'n', brand: '  ' })
      expect(a.body.product.brand).toBeNull()
      const res = await api().post('/api/products').send({ barcode: 'x2' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'Faltan barcode o nombre' })
    })
  })

  describe('GET /:id/insights', () => {
    it('prices null when pricely has nothing', async () => {
      const p = await makeProduct({ barcode: GOOD_EAN })
      const res = await api().get(`/api/products/${p.id}/insights`)
      expect(res.status).toBe(200)
      expect(res.body.prices).toBeNull()
      expectProductShape(res.body.product)
    })

    it('returns prices and backfills empty fields', async () => {
      const p = await makeProduct({ barcode: GOOD_EAN })
      const market = { market: 'Coto', price: 10, listPrice: null, promo: null, url: null, updatedAt: null }
      vi.mocked(pricelyInsights).mockResolvedValueOnce({
        markets: [market],
        avgPrice: 12,
        categories: ['almacen'],
        description: 'desc',
        blurHash: 'bh',
        imageUrl: 'https://images.pricely.ar/x.png',
      })
      const res = await api().get(`/api/products/${p.id}/insights`)
      expect(res.body.prices).toEqual({ markets: [market], avgPrice: 12, cheapest: market })
      expect(res.body.product).toMatchObject({
        description: 'desc', blurHash: 'bh', categories: ['almacen'], imageUrl: 'https://images.pricely.ar/x.png',
      })
    })

    it('unknown -> 404, non-uuid -> 400', async () => {
      const res = await api().get(`/api/products/${NIL_UUID}/insights`)
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Producto no encontrado' })
      expect((await api().get('/api/products/abc/insights')).status).toBe(400)
    })
  })

  describe('POST /backfill-categories', () => {
    it('fills categories for products pricely knows', async () => {
      const known = await makeProduct({ barcode: '7790000000001' })
      await makeProduct({ barcode: 'manual-code' }) // not an EAN: skipped
      vi.mocked(pricelyCategories).mockResolvedValue(['bebidas'])
      const res = await api().post('/api/products/backfill-categories')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ updated: 1, remaining: 0 })
      expect((await prisma.product.findUniqueOrThrow({ where: { id: known.id } })).categories).toEqual(['bebidas'])
    })
  })
})
