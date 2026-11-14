import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { z, ZodError } from 'zod'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Validate `data` against `schema`; a failure becomes a 400 via the error handler. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  return schema.parse(data)
}

export const uuid = (message: string) => z.uuid({ error: message })
export const idParams = z.object({ id: uuid('Id inválido') })

/** Finite number >= 0 (stock quantities). */
export const nonNegative = (message: string) =>
  z.number({ error: message }).finite(message).min(0, message)

/** Central error handler: clients always get `{ error: string }`. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message })
  if (err instanceof ZodError) {
    return void res.status(400).json({ error: err.issues[0]?.message ?? 'Datos inválidos' })
  }
  const type = (err as { type?: string } | null)?.type
  if (type === 'entity.parse.failed') return void res.status(400).json({ error: 'JSON inválido' })
  if (type === 'entity.too.large') return void res.status(413).json({ error: 'Pedido demasiado grande' })

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const fk = err.code === 'P2010' && (err.meta as { code?: string } | undefined)?.code === '23503'
    if (err.code === 'P2003' || fk) return void res.status(404).json({ error: 'Producto no encontrado' })
    if (err.code === 'P2025') return void res.status(404).json({ error: 'No encontrado' })
    if (err.code === 'P2002') return void res.status(409).json({ error: 'Ya existe' })
  }

  console.error(err)
  res.status(500).json({ error: 'Algo salió mal' })
}
