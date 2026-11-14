/**
 * Bulk-import barcodes into the product catalog.
 *
 * Reads a CSV of barcodes and POSTs each one to the backend's resolve endpoint,
 * which looks it up (pricely.ar first, Open Food Facts as fallback) and caches
 * any new ones in the `products` table. Catalog only — it never touches stock.
 *
 * Usage:
 *   npm run import:barcodes -- path/to/barcodes.csv
 *   npm run import:barcodes -- barcodes.csv --delay=300
 *
 * CSV: one barcode per line. A header row "barcode" is ignored, as are blank
 * lines and lines starting with "#". Extra columns are ignored.
 *
 * Reads VITE_API_URL from .env.local (same file the app uses); override with
 * the API_URL env var. Defaults to http://localhost:3001.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Minimal .env.local loader — only KEY=VALUE lines, no deps. */
function loadEnvLocal() {
  const envPath = resolve(projectRoot, '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function parseArgs(argv: string[]) {
  let csvPath: string | undefined
  let delay = 250
  for (const arg of argv) {
    if (arg.startsWith('--delay=')) delay = Number(arg.slice('--delay='.length)) || delay
    else if (!arg.startsWith('--')) csvPath = arg
  }
  return { csvPath, delay }
}

/** First column of each non-empty, non-comment, non-header line. */
function readBarcodes(csvPath: string): string[] {
  const text = readFileSync(csvPath, 'utf8')
  const out: string[] = []
  const seen = new Set<string>()
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const cell = line.split(',')[0]!.trim().replace(/^["']|["']$/g, '')
    if (!cell || cell.toLowerCase() === 'barcode') continue
    if (!/^\d{6,14}$/.test(cell)) {
      console.warn(`  skip (not a barcode): ${cell}`)
      continue
    }
    if (seen.has(cell)) continue
    seen.add(cell)
    out.push(cell)
  }
  return out
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  loadEnvLocal()

  const { csvPath, delay } = parseArgs(process.argv.slice(2))
  if (!csvPath) {
    console.error('Usage: npm run import:barcodes -- path/to/barcodes.csv [--delay=250]')
    process.exit(1)
  }
  const fullPath = resolve(process.cwd(), csvPath)
  if (!existsSync(fullPath)) {
    console.error(`CSV not found: ${fullPath}`)
    process.exit(1)
  }

  const apiUrl = process.env.API_URL ?? process.env.VITE_API_URL ?? 'http://localhost:3001'

  const barcodes = readBarcodes(fullPath)
  console.log(`\nFound ${barcodes.length} unique barcode(s) in ${csvPath}`)
  console.log(`Resolving via ${apiUrl}\n`)

  let resolved = 0
  const notFound: string[] = []

  for (let i = 0; i < barcodes.length; i++) {
    const barcode = barcodes[i]!
    const prefix = `[${i + 1}/${barcodes.length}] ${barcode}`

    try {
      const res = await fetch(`${apiUrl}/api/products/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode }),
      })

      if (res.status === 404) {
        notFound.push(barcode)
        console.log(`${prefix} — not found`)
      } else if (res.ok) {
        const data = (await res.json()) as { product: { name: string } }
        resolved++
        console.log(`${prefix} — ok "${data.product.name}"`)
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        console.error(`${prefix} — error: ${data?.error ?? res.status}`)
      }
    } catch (e) {
      console.error(`${prefix} — request failed: ${e instanceof Error ? e.message : e}`)
    }

    await sleep(delay)
  }

  console.log('\n────────────────────────────')
  console.log(`Resolved (added or cached): ${resolved}`)
  console.log(`Not found:                  ${notFound.length}`)
  if (notFound.length > 0) {
    console.log('\nNot found (add these by hand in the app):')
    for (const b of notFound) console.log(`  ${b}`)
  }
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
