import express, { type Express } from 'express'
import cors from 'cors'
import { products } from './routes/products.js'
import { stock } from './routes/stock.js'
import { shopping } from './routes/shopping.js'
import { errorHandler } from './http.js'
import { mountWeb } from './static.js'

/** Comma-separated allowlist; requests without an Origin header (native apps) are unaffected. */
function allowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? 'http://localhost:8081'
  return raw.split(',').map((o) => o.trim()).filter(Boolean)
}

/** Configures `app` (a fresh express() by default, so tests can call createApp()). */
export function createApp(app: Express = express()) {
  app.use(cors({ origin: allowedOrigins() }))
  app.use(express.json())

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use('/api/products', products)
  app.use('/api/stock', stock)
  app.use('/api/shopping', shopping)

  mountWeb(app)

  app.use(errorHandler)
  return app
}
