import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { serializeShoppingItem } from '../serialize.js'
import { HttpError, idParams, parse, uuid } from '../http.js'

export const shopping = Router()

/** Items at or below their reorder threshold (or out of stock). */
function isLow(quantity: number, minQty: number | null): boolean {
  return quantity <= 0 || (minQty != null && minQty > 0 && quantity <= minQty)
}

/** Shopping quantities are whole units >= 1: rounded, then clamped. */
const quantitySchema = z
  .number({ error: 'Cantidad inválida' })
  .finite('Cantidad inválida')
  .transform((n) => Math.max(1, Math.round(n)))

shopping.get('/', async (_req, res) => {
  const items = await prisma.shoppingItem.findMany({
    include: { product: true },
    orderBy: { createdAt: 'asc' },
  })
  res.json(items.map(serializeShoppingItem))
})

const addBody = z.object({
  productId: uuid('productId inválido').nullish(),
  name: z.string({ error: 'Nombre requerido' }).trim().nullish(),
  quantity: quantitySchema.nullish(),
})

/**
 * Add an item. Either `{ productId }` (a catalog product — e.g. scanned on the
 * phone) or `{ name }` (free text). Product rows stay one-per-product: if it's
 * already on the list the existing row is returned unchanged (200, not 201).
 */
shopping.post('/', async (req, res) => {
  const body = parse(addBody, req.body ?? {})
  const quantity = body.quantity ?? 1

  if (body.productId) {
    const productId = body.productId
    const existing = () =>
      prisma.shoppingItem.findFirst({ where: { productId }, include: { product: true } })

    const found = await existing()
    if (found) return res.json(serializeShoppingItem(found))

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) throw new HttpError(404, 'Producto no encontrado')

    try {
      const item = await prisma.shoppingItem.create({
        data: { productId, quantity, checked: false },
        include: { product: true },
      })
      return res.status(201).json(serializeShoppingItem(item))
    } catch (e) {
      // lost a race against an identical request: the row exists now
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const winner = await existing()
        if (winner) return res.json(serializeShoppingItem(winner))
      }
      throw e
    }
  }

  if (!body.name) throw new HttpError(400, 'Nombre requerido')
  const item = await prisma.shoppingItem.create({
    data: { name: body.name, quantity, checked: false },
    include: { product: true },
  })
  res.status(201).json(serializeShoppingItem(item))
})

/** Add every low-stock product not already on the list. Returns how many were added. */
shopping.post('/generate', async (_req, res) => {
  const stockItems = await prisma.stockItem.findMany()

  const rows = stockItems
    .filter((s) => isLow(Number(s.quantity), s.minQty == null ? null : Number(s.minQty)))
    .map((s) => {
      const min = s.minQty == null ? null : Number(s.minQty)
      const quantity = min != null && min > 0 ? Math.max(1, min - Number(s.quantity)) : 1
      return { productId: s.productId, quantity, checked: false }
    })

  // the partial unique index on product_id makes skipDuplicates race-safe
  const { count } = await prisma.shoppingItem.createMany({ data: rows, skipDuplicates: true })
  res.json({ added: count })
})

const patchBody = z.object({
  quantity: quantitySchema.nullish(),
  checked: z.boolean({ error: 'checked debe ser true o false' }).nullish(),
})

shopping.patch('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params)
  const body = parse(patchBody, req.body ?? {})
  const data: { quantity?: number; checked?: boolean } = {}
  if (body.quantity != null) data.quantity = body.quantity
  if (body.checked != null) data.checked = body.checked

  const item = await prisma.shoppingItem.update({ where: { id }, data, include: { product: true } })
  res.json(serializeShoppingItem(item))
})

// must be registered before "/:id" so it isn't captured as an id
shopping.delete('/checked', async (_req, res) => {
  await prisma.shoppingItem.deleteMany({ where: { checked: true } })
  res.status(204).end()
})

shopping.delete('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params)
  await prisma.shoppingItem.delete({ where: { id } })
  res.status(204).end()
})
