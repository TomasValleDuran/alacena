import { Router } from 'express'
import { prisma } from '../db.js'
import { serializeProduct } from '../serialize.js'
import { isPlausibleRetailCode } from '../lib/barcode.js'
import { lookupPricely } from '../lib/pricely.js'
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
