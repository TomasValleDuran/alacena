import { Router } from 'express'
import { prisma } from '../db.js'
import { serializeShoppingItem } from '../serialize.js'

export const shopping = Router()

/** Items at or below their reorder threshold (or out of stock). */
function isLow(quantity: number, minQty: number | null): boolean {
  return quantity <= 0 || (minQty != null && minQty > 0 && quantity <= minQty)
}

shopping.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.shoppingItem.findMany({
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json(items.map(serializeShoppingItem))
  } catch (e) {
    next(e)
  }
})

/** Free-text item not tied to a catalog product. */
shopping.post('/', async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? '').trim()
    if (!name) return res.status(400).json({ error: 'Nombre requerido' })
    const quantity = Math.max(1, Number(req.body?.quantity) || 1)

    const item = await prisma.shoppingItem.create({
      data: { name, quantity, checked: false },
      include: { product: true },
    })
    res.status(201).json(serializeShoppingItem(item))
  } catch (e) {
    next(e)
  }
})

/** Add every low-stock product not already on the list. Returns how many were added. */
shopping.post('/generate', async (_req, res, next) => {
  try {
    const [stockItems, listed] = await Promise.all([
      prisma.stockItem.findMany(),
      prisma.shoppingItem.findMany({
        where: { productId: { not: null } },
        select: { productId: true },
      }),
    ])
    const onList = new Set(listed.map((r) => r.productId))

    const rows = stockItems
      .filter((s) => {
        const min = s.minQty == null ? null : Number(s.minQty)
        return isLow(Number(s.quantity), min) && !onList.has(s.productId)
      })
      .map((s) => {
        const min = s.minQty == null ? null : Number(s.minQty)
        const quantity = min != null && min > 0 ? Math.max(1, min - Number(s.quantity)) : 1
        return { productId: s.productId, quantity, checked: false }
      })

    if (rows.length === 0) return res.json({ added: 0 })

    await prisma.shoppingItem.createMany({ data: rows })
    res.json({ added: rows.length })
  } catch (e) {
    next(e)
  }
})

shopping.patch('/:id', async (req, res, next) => {
  try {
    const data: { quantity?: number; checked?: boolean } = {}
    if (req.body?.quantity != null) data.quantity = Math.max(1, Math.round(Number(req.body.quantity)))
    if (req.body?.checked != null) data.checked = Boolean(req.body.checked)

    const item = await prisma.shoppingItem.update({
      where: { id: req.params.id },
      data,
      include: { product: true },
    })
    res.json(serializeShoppingItem(item))
  } catch (e) {
    next(e)
  }
})

// must be registered before "/:id" so it isn't captured as an id
shopping.delete('/checked', async (_req, res, next) => {
  try {
    await prisma.shoppingItem.deleteMany({ where: { checked: true } })
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

shopping.delete('/:id', async (req, res, next) => {
  try {
    await prisma.shoppingItem.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})
