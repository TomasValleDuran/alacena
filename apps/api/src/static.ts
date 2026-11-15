import express, { type Express, type RequestHandler } from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'

const IMMUTABLE = 'public, max-age=31536000, immutable'
const NO_CACHE = 'no-cache'

/**
 * Always answers unmatched `/api` routes with a JSON 404, and, when the exported
 * web app is present (`WEB_DIR`, default `./public`, must contain index.html),
 * serves it from the same origin with an SPA fallback for client-side routes.
 * Mount after the API routes and before the error handler.
 */
export function mountWeb(app: Express): void {
  app.use('/api', (_req, res) => void res.status(404).json({ error: 'No encontrado' }))

  const dir = path.resolve(process.env.WEB_DIR ?? './public')
  const index = path.join(dir, 'index.html')
  const enabled = existsSync(index)
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[alacena] web app: ${enabled ? `serving ${dir}` : `not served (no ${index})`}`)
  }
  if (!enabled) return

  app.use(
    express.static(dir, {
      setHeaders(res, file) {
        const rel = path.relative(dir, file).split(path.sep).join('/')
        if (rel.startsWith('_expo/static/')) res.setHeader('Cache-Control', IMMUTABLE)
        else if (rel === 'index.html' || rel === 'manifest.json') res.setHeader('Cache-Control', NO_CACHE)
      },
    }),
  )

  const fallback: RequestHandler = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    // requests for a file (has an extension) that static did not find are real 404s
    if (path.extname(req.path) !== '' || !req.accepts('html')) return next()
    res.setHeader('Cache-Control', NO_CACHE)
    res.sendFile(index)
  }
  app.use(fallback)
}
