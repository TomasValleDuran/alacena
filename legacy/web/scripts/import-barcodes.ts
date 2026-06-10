/**
 * Bulk-import barcodes into the product catalog.
 *
 * Reads a CSV of barcodes, looks each one up with the SAME resolver the app
 * uses (pricely.ar first, Open Food Facts as fallback) and inserts any new
 * ones into the `products` table. Catalog only — it never touches stock.
 *
 * Usage:
 *   npm run import:barcodes -- path/to/barcodes.csv
 *   npm run import:barcodes -- barcodes.csv --delay=300
 *
 * CSV: one barcode per line. A header row "barcode" is ignored, as are blank
 * lines and lines starting with "#". Extra columns are ignored.
 *
 * Credentials are read from .env.local (VITE_SUPABASE_URL,
 * VITE_SUPABASE_PUBLISHABLE_KEY) — the same file the app uses.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { lookupPricely } from '../src/lib/pricely.ts'
import { lookupBarcode } from '../src/lib/openFoodFacts.ts'

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

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    console.error(
      'Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (looked in .env.local).',
    )
    process.exit(1)
  }
  const supabase = createClient(url, key)

  const barcodes = readBarcodes(fullPath)
  console.log(`\nFound ${barcodes.length} unique barcode(s) in ${csvPath}\n`)

  let added = 0
  let existed = 0
  const notFound: string[] = []

  for (let i = 0; i < barcodes.length; i++) {
    const barcode = barcodes[i]!
    const prefix = `[${i + 1}/${barcodes.length}] ${barcode}`

    const { data: cached, error: findErr } = await supabase
      .from('products')
      .select('id, name')
      .eq('barcode', barcode)
      .maybeSingle()
    if (findErr) {
      console.error(`${prefix} — db error: ${findErr.message}`)
      continue
    }
    if (cached) {
      existed++
      console.log(`${prefix} — already in catalog (${(cached as { name: string }).name})`)
      continue
    }

    let source = 'pricely'
    let found = await lookupPricely(barcode)
    if (!found) {
      source = 'openfoodfacts'
      found = await lookupBarcode(barcode)
    }

    if (!found) {
      notFound.push(barcode)
      console.log(`${prefix} — not found`)
      await sleep(delay)
      continue
    }

    const { error: insErr } = await supabase.from('products').insert({
      barcode: found.barcode,
      name: found.name,
      brand: found.brand ?? null,
      image_url: found.image_url ?? null,
      category: found.category ?? null,
      unit: found.unit ?? null,
    })

    if (insErr) {
      // 23505 = unique violation: inserted by another run between our check and insert
      if (insErr.code === '23505') {
        existed++
        console.log(`${prefix} — already in catalog`)
      } else {
        console.error(`${prefix} — insert error: ${insErr.message}`)
      }
    } else {
      added++
      console.log(`${prefix} — added "${found.name}" (${source})`)
    }

    await sleep(delay)
  }

  console.log('\n────────────────────────────')
  console.log(`Added:      ${added}`)
  console.log(`Already in: ${existed}`)
  console.log(`Not found:  ${notFound.length}`)
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
