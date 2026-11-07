import { Router } from 'express'
import { prisma } from '../db.js'
import { serializeProduct } from '../serialize.js'
import { isPlausibleRetailCode } from '../lib/barcode.js'
import { lookupPricely, pricelyCategories, pricelyInsights } from '../lib/pricely.js'
import { lookupBarcode } from '../lib/openFoodFacts.js'
import type { ProductInsert } from '../lib/types.js'

export const products = Router()

/** Find-or-create a product by barcode (manual creation path). */
async function upsertByBarcode(insert: ProductInsert) {
  return prisma.product.upsert({
    where: { barcode: insert.barcode },
    update: {}, // never clobber an existing catalog entry
    create: {
      barcode: insert.barcode,
      name: insert.name,
      brand: insert.brand ?? null,
      imageUrl: insert.imageUrl ?? null,
      category: insert.category ?? null,
      unit: insert.unit ?? null,
      description: insert.description ?? null,
      blurHash: insert.blurHash ?? null,
      categories: insert.categories ?? [],
    },
  })
}

/**
 * Resolve a scanned barcode: local cache → pricely.ar → Open Food Facts.
 * Caches the first hit in `products`. 404 (with {found:false}) when nothing
 * knows the code, so the client can prompt for a manual name.
 */
products.post('/resolve', async (req, res, next) => {
  try {
    const barcode = String(req.body?.barcode ?? '').trim()
    if (barcode.length < 4) return res.status(400).json({ error: 'Código inválido' })
    if (!isPlausibleRetailCode(barcode)) {
      return res.status(422).json({ error: `El código ${barcode} no pasa la verificación EAN.` })
    }

    const cached = await prisma.product.findUnique({ where: { barcode } })
    if (cached) return res.json({ product: serializeProduct(cached) })

    const found = (await lookupPricely(barcode)) ?? (await lookupBarcode(barcode))
    if (!found) return res.status(404).json({ found: false })

    const product = await upsertByBarcode(found)
    res.json({ product: serializeProduct(product) })
  } catch (e) {
    next(e)
  }
})

/** Manual create (used by the "sin código de barras" form). */
products.post('/', async (req, res, next) => {
  try {
    const barcode = String(req.body?.barcode ?? '').trim()
    const name = String(req.body?.name ?? '').trim()
    if (!barcode || !name) return res.status(400).json({ error: 'Faltan barcode o nombre' })

    const brand = req.body?.brand ? String(req.body.brand).trim() || null : null
    const product = await upsertByBarcode({ barcode, name, brand })
    res.status(201).json({ product: serializeProduct(product) })
  } catch (e) {
    next(e)
  }
})

/**
 * Fill in categories for products that don't have them yet (scanned before
 * categories were stored). Paced and capped per call; the app calls it in the
 * background when it sees uncategorized products. Products pricely doesn't
 * know stay empty and are skipped by later calls in this server's lifetime.
 */
const noCategories = new Set<string>()
let backfilling = false

products.post('/backfill-categories', async (_req, res, next) => {
  if (backfilling) return res.json({ updated: 0, remaining: null, busy: true })
  backfilling = true
  try {
    const candidates = await prisma.product.findMany({
      where: { categories: { isEmpty: true } },
      select: { id: true, barcode: true },
    })
    const todo = candidates.filter((p) => /^\d{6,14}$/.test(p.barcode) && !noCategories.has(p.id))
    const batch = todo.slice(0, 40)
    let updated = 0
    for (const p of batch) {
      const cats = await pricelyCategories(p.barcode)
      if (cats && cats.length > 0) {
        await prisma.product.update({ where: { id: p.id }, data: { categories: cats } })
        updated++
      } else {
        noCategories.add(p.id)
      }
      await new Promise((r) => setTimeout(r, 150)) // be gentle with pricely
    }
    res.json({ updated, remaining: todo.length - batch.length })
  } catch (e) {
    next(e)
  } finally {
    backfilling = false
  }
})

/**
 * Live extras from pricely for one product: prices per market (cheapest
 * first) and categories. Also backfills the product's empty description /
 * blurHash / categories / image, so products scanned before this existed (or
 * added by hand) catch up. `prices: null` = pricely doesn't know it or is down.
 */
products.get('/:id/insights', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } })
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' })

    const info = await pricelyInsights(product.barcode)
    if (!info) return res.json({ product: serializeProduct(product), prices: null })

    const patch: { description?: string; blurHash?: string; categories?: string[]; imageUrl?: string } = {}
    if (!product.description && info.description) patch.description = info.description
    if (!product.blurHash && info.blurHash) patch.blurHash = info.blurHash
    if (product.categories.length === 0 && info.categories.length > 0) patch.categories = info.categories
    if (!product.imageUrl && info.imageUrl) patch.imageUrl = info.imageUrl
    const updated = Object.keys(patch).length
      ? await prisma.product.update({ where: { id: product.id }, data: patch })
      : product

    res.json({
      product: serializeProduct(updated),
      prices: {
        markets: info.markets,
        avgPrice: info.avgPrice,
        cheapest: info.markets[0] ?? null,
      },
    })
  } catch (e) {
    next(e)
  }
})
