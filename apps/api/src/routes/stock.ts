import { Router } from 'express'
import { prisma } from '../db.js'
import { serializeStockItem } from '../serialize.js'

export const stock = Router()

/** Full pantry, newest activity first. */
stock.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.stockItem.findMany({
      include: { product: true },
      orderBy: { updatedAt: 'desc' },
    })
    res.json(items.map(serializeStockItem))
  } catch (e) {
    next(e)
  }
})

/**
 * Add `delta` to a product's stock, creating the row if missing.
 * Negative deltas subtract (floored at 0). Returns the resulting quantity.
 */
stock.post('/add', async (req, res, next) => {
  try {
    const productId = String(req.body?.productId ?? '')
    const delta = Number(req.body?.delta)
    if (!productId || !Number.isFinite(delta)) {
      return res.status(400).json({ error: 'productId y delta requeridos' })
    }

    const quantity = await prisma.$transaction(async (tx) => {
      const existing = await tx.stockItem.findUnique({ where: { productId } })
      const next = Math.max(0, (existing ? Number(existing.quantity) : 0) + delta)
      if (existing) {
        await tx.stockItem.update({
          where: { id: existing.id },
          data: { quantity: next, updatedAt: new Date() },
        })
      } else {
        await tx.stockItem.create({
          data: { productId, quantity: next, minQty: 0 },
        })
      }
      return next
    })

    res.json({ quantity })
  } catch (e) {
    next(e)
  }
})

/** Set quantity and/or min_qty on an existing stock row. */
stock.patch('/:id', async (req, res, next) => {
  try {
    const data: { quantity?: number; minQty?: number; updatedAt: Date } = { updatedAt: new Date() }
    if (req.body?.quantity != null) data.quantity = Math.max(0, Number(req.body.quantity))
    if (req.body?.minQty != null) data.minQty = Math.max(0, Number(req.body.minQty))

    const item = await prisma.stockItem.update({
      where: { id: req.params.id },
      data,
      include: { product: true },
    })
    res.json(serializeStockItem(item))
  } catch (e) {
    next(e)
  }
})

stock.delete('/:id', async (req, res, next) => {
  try {
    await prisma.stockItem.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})
