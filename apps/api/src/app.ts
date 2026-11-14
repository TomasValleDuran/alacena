import express from 'express'
import cors from 'cors'
import { products } from './routes/products.js'
import { stock } from './routes/stock.js'
import { shopping } from './routes/shopping.js'
import { errorHandler } from './http.js'

/** Comma-separated allowlist; requests without an Origin header (native apps) are unaffected. */
function allowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? 'http://localhost:8081'
  return raw.split(',').map((o) => o.trim()).filter(Boolean)
}

export function createApp() {
  const app = express()

  app.use(cors({ origin: allowedOrigins() }))
  app.use(express.json())

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use('/api/products', products)
  app.use('/api/stock', stock)
  app.use('/api/shopping', shopping)

  app.use(errorHandler)
  return app
}
