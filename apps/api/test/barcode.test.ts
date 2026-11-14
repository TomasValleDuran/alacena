import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isEan, isPlausibleRetailCode } from '../src/lib/barcode.js'

describe('isPlausibleRetailCode', () => {
  it('accepts valid EAN-13, EAN-8 and UPC-A', () => {
    expect(isPlausibleRetailCode('7790070410122')).toBe(true)
    expect(isPlausibleRetailCode('96385074')).toBe(true)
    expect(isPlausibleRetailCode('036000291452')).toBe(true)
  })

  it('rejects a wrong check digit', () => {
    expect(isPlausibleRetailCode('7790070410121')).toBe(false)
    expect(isPlausibleRetailCode('96385073')).toBe(false)
    expect(isPlausibleRetailCode('036000291453')).toBe(false)
  })

  it('does not judge non-numeric or oddly sized codes', () => {
    expect(isPlausibleRetailCode('abc123')).toBe(true)
    expect(isPlausibleRetailCode('12345')).toBe(true)
    expect(isPlausibleRetailCode('12345678901234')).toBe(true)
  })
})

describe('isEan', () => {
  it('is 6 to 14 digits', () => {
    expect(isEan('123456')).toBe(true)
    expect(isEan('12345678901234')).toBe(true)
    expect(isEan('12345')).toBe(false)
    expect(isEan('123456789012345')).toBe(false)
    expect(isEan('12345a')).toBe(false)
    expect(isEan('')).toBe(false)
  })
})

// Shared fixture owned by tools/: skipped when the file isn't there.
const fixturePath = fileURLToPath(new URL('../../../tools/fixtures/barcodes.json', import.meta.url))
describe.skipIf(!existsSync(fixturePath))('shared barcode fixtures', () => {
  it('agree with isPlausibleRetailCode', () => {
    const data = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown
    const raw = Array.isArray(data) ? data : ((data as Record<string, unknown>).cases ?? data)
    const cases = (Array.isArray(raw) ? raw : Object.entries(raw as object).map(([code, v]) => ({ code, ...(typeof v === 'object' ? v : { valid: v }) }))) as Record<string, unknown>[]
    let checked = 0
    for (const c of cases) {
      const code = (c.code ?? c.barcode ?? c.input) as string | undefined
      const valid = (c.valid ?? c.plausible ?? c.expected) as boolean | undefined
      if (typeof code !== 'string' || typeof valid !== 'boolean') continue
      expect(isPlausibleRetailCode(code), code).toBe(valid)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })
})
