import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { products } from './routes/products.js'
import { stock } from './routes/stock.js'
import { shopping } from './routes/shopping.js'

const app = express()

app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/products', products)
app.use('/api/stock', stock)
app.use('/api/shopping', shopping)

// central error handler: routes call next(e); clients get { error }
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Algo salió mal'
  console.error(err)
  res.status(500).json({ error: message })
})

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => console.log(`[alacena] API on http://localhost:${port}`))
