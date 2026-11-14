import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { serializeStockItem } from '../serialize.js'
import { HttpError, idParams, nonNegative, parse, uuid } from '../http.js'

export const stock = Router()

/** Full pantry, newest activity first. */
stock.get('/', async (_req, res) => {
  const items = await prisma.stockItem.findMany({
    include: { product: true },
    orderBy: { updatedAt: 'desc' },
  })
  res.json(items.map(serializeStockItem))
})

const addBody = z.object({
  productId: uuid('productId y delta requeridos'),
  delta: z.number({ error: 'productId y delta requeridos' }).finite('delta inválido'),
})

/**
 * Add `delta` to a product's stock, creating the row if missing.
 * Negative deltas subtract (floored at 0; a row that reaches 0 is kept).
 * One atomic upsert, so concurrent adds never lose an increment.
 * Returns the resulting quantity.
 */
stock.post('/add', async (req, res) => {
  const { productId, delta } = parse(addBody, req.body ?? {})
  const rows = await prisma.$queryRaw<{ quantity: unknown }[]>`
    INSERT INTO stock_items (id, product_id, quantity, min_qty, updated_at)
    VALUES (gen_random_uuid(), ${productId}::uuid, GREATEST(0, ${delta}::numeric), 0, now())
    ON CONFLICT (product_id) DO UPDATE
      SET quantity = GREATEST(0, stock_items.quantity + ${delta}::numeric), updated_at = now()
    RETURNING quantity`
  if (!rows[0]) throw new HttpError(500, 'Algo salió mal')
  res.json({ quantity: Number(rows[0].quantity) })
})

const patchBody = z.object({
  quantity: nonNegative('Cantidad inválida').nullish(),
  minQty: nonNegative('Mínimo inválido').nullish(),
})

/** Set quantity and/or min_qty on an existing stock row. */
stock.patch('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params)
  const body = parse(patchBody, req.body ?? {})
  const data: { quantity?: number; minQty?: number; updatedAt: Date } = { updatedAt: new Date() }
  if (body.quantity != null) data.quantity = body.quantity
  if (body.minQty != null) data.minQty = body.minQty

  const item = await prisma.stockItem.update({ where: { id }, data, include: { product: true } })
  res.json(serializeStockItem(item))
})

stock.delete('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params)
  await prisma.stockItem.delete({ where: { id } })
  res.status(204).end()
})
