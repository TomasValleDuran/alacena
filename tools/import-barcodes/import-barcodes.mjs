#!/usr/bin/env node
/**
 * Bulk-import barcodes into the product catalog.
 *
 * Reads a CSV of barcodes and POSTs each one to the API's resolve endpoint,
 * which looks it up (pricely.ar first, Open Food Facts as fallback) and caches
 * any new ones in the `products` table. Catalog only — it never touches stock.
 *
 * Plain Node (18+), no dependencies. Run `node import-barcodes.mjs --help`.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_API_URL = 'http://localhost:3001'
const DEFAULT_DELAY_MS = 250

const USAGE = `Usage: node tools/import-barcodes/import-barcodes.mjs <barcodes.csv> [--delay=MS]

Reads barcodes from the first column of a CSV and POSTs each one to
<API_URL>/api/products/resolve, so new products get cached in the catalog.
Stock is never touched.

CSV: one barcode per line. A "barcode" header row, blank lines and lines
starting with "#" are ignored, as are extra columns. Values that are not
6-14 digits are skipped with a warning; duplicates are resolved once.

Options:
  --delay=MS   pause between requests in milliseconds (default ${DEFAULT_DELAY_MS})
  -h, --help   show this help

Environment:
  API_URL      base URL of the API (default ${DEFAULT_API_URL})
`

function parseArgs(argv) {
  let csvPath
  let delay = DEFAULT_DELAY_MS
  let help = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') help = true
    else if (arg.startsWith('--delay=') || arg === '--delay') {
      const raw = arg === '--delay' ? argv[++i] : arg.slice('--delay='.length)
      const n = Number(raw)
      if (raw !== undefined && raw !== '' && Number.isFinite(n) && n >= 0) delay = n
      else console.warn(`  ignoring invalid --delay value: ${raw ?? '(missing)'}`)
    } else if (!arg.startsWith('-')) csvPath = arg
  }
  return { csvPath, delay, help }
}

/** First column of each non-empty, non-comment, non-header line, de-duplicated. */
function readBarcodes(csvPath) {
  const text = readFileSync(csvPath, 'utf8')
  const out = []
  const seen = new Set()
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const cell = line.split(',')[0].trim().replace(/^["']|["']$/g, '')
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const { csvPath, delay, help } = parseArgs(process.argv.slice(2))
  if (help) {
    process.stdout.write(USAGE)
    return
  }
  if (!csvPath) {
    process.stderr.write(USAGE)
    process.exit(1)
  }
  const fullPath = resolve(process.cwd(), csvPath)
  if (!existsSync(fullPath)) {
    console.error(`CSV not found: ${fullPath}`)
    process.exit(1)
  }

  const apiUrl = (process.env.API_URL || DEFAULT_API_URL).replace(/\/+$/, '')

  const barcodes = readBarcodes(fullPath)
  console.log(`\nFound ${barcodes.length} unique barcode(s) in ${csvPath}`)
  console.log(`Resolving via ${apiUrl}\n`)

  let resolved = 0
  const notFound = []

  for (let i = 0; i < barcodes.length; i++) {
    const barcode = barcodes[i]
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
        const data = await res.json()
        resolved++
        console.log(`${prefix} — ok "${data?.product?.name ?? '?'}"`)
      } else {
        const data = await res.json().catch(() => null)
        console.error(`${prefix} — error: ${data?.error ?? res.status}`)
      }
    } catch (e) {
      console.error(`${prefix} — request failed: ${e instanceof Error ? e.message : e}`)
    }

    if (i < barcodes.length - 1) await sleep(delay)
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
