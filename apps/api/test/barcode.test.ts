import { readFileSync } from 'node:fs'
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

// Shared vectors, also read by the app's barcode tests.
const fixturePath = fileURLToPath(new URL('../../../tools/fixtures/barcodes.json', import.meta.url))
describe('shared barcode fixtures', () => {
  const cases = JSON.parse(readFileSync(fixturePath, 'utf8')) as { code: string; valid: boolean }[]
  it.each(cases)('$code → $valid', ({ code, valid }) => {
    expect(isPlausibleRetailCode(code)).toBe(valid)
  })
})
