import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/create-app.js'

let dir: string
let empty: string

function appWith(webDir: string) {
  process.env.WEB_DIR = webDir
  try {
    return request(createApp())
  } finally {
    delete process.env.WEB_DIR
  }
}

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'alacena-web-'))
  empty = mkdtempSync(path.join(tmpdir(), 'alacena-noweb-'))
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Alacena</title>')
  writeFileSync(path.join(dir, 'manifest.json'), '{"name":"Alacena"}')
  mkdirSync(path.join(dir, '_expo/static/js/web'), { recursive: true })
  writeFileSync(path.join(dir, '_expo/static/js/web/entry-abc123.js'), 'console.log(1)')
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
  rmSync(empty, { recursive: true, force: true })
})

describe('static web serving', () => {
  it('serves index.html at /', async () => {
    const res = await appWith(dir).get('/')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/html/)
    expect(res.text).toContain('<title>Alacena</title>')
  })

  it('falls back to index.html for client-side routes', async () => {
    for (const url of ['/list', '/item/3f2a', '/settings']) {
      const res = await appWith(dir).get(url).set('Accept', 'text/html')
      expect(res.status, url).toBe(200)
      expect(res.text, url).toContain('<title>Alacena</title>')
    }
  })

  it('does not fall back for non-GET requests or non-HTML clients', async () => {
    expect((await appWith(dir).post('/list')).status).toBe(404)
    expect((await appWith(dir).get('/list').set('Accept', 'application/json')).status).toBe(404)
  })

  it('never shadows /health or the API', async () => {
    const health = await appWith(dir).get('/health')
    expect(health.body).toEqual({ ok: true })
    const stock = await appWith(dir).get('/api/stock')
    expect(stock.status).toBe(200)
    expect(stock.headers['content-type']).toMatch(/json/)
  })

  it('returns a JSON 404 for unknown /api paths', async () => {
    for (const web of [dir, empty]) {
      const res = await appWith(web).get('/api/nope').set('Accept', 'text/html')
      expect(res.status).toBe(404)
      expect(res.headers['content-type']).toMatch(/json/)
      expect(res.body).toEqual({ error: 'No encontrado' })
    }
  })

  it('404s for missing assets with a file extension', async () => {
    const res = await appWith(dir).get('/_expo/static/js/missing.js')
    expect(res.status).toBe(404)
    expect(res.text).not.toContain('Alacena')
  })

  it('sets cache headers', async () => {
    const asset = await appWith(dir).get('/_expo/static/js/web/entry-abc123.js')
    expect(asset.status).toBe(200)
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable')
    expect((await appWith(dir).get('/')).headers['cache-control']).toBe('no-cache')
    expect((await appWith(dir).get('/index.html')).headers['cache-control']).toBe('no-cache')
    expect((await appWith(dir).get('/manifest.json')).headers['cache-control']).toBe('no-cache')
    expect((await appWith(dir).get('/list')).headers['cache-control']).toBe('no-cache')
  })

  it('behaves as before when the directory is absent', async () => {
    const missing = path.join(empty, 'nope')
    for (const web of [empty, missing]) {
      expect((await appWith(web).get('/')).status).toBe(404)
      expect((await appWith(web).get('/list')).status).toBe(404)
      expect((await appWith(web).get('/health')).body).toEqual({ ok: true })
    }
  })
})
