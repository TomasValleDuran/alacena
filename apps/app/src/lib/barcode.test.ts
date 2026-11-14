import vectors from '../../../../tools/fixtures/barcodes.json'

import { isPlausibleRetailCode, manualBarcode, normalizeScanned } from './barcode'

type Vector = { code: string; valid: boolean; note: string; normalized?: string }

describe('isPlausibleRetailCode (shared vectors)', () => {
  it.each((vectors as Vector[]).map((v) => [v.code, v.valid, v.note] as const))(
    '%j -> %s (%s)',
    (code, valid) => {
      expect(isPlausibleRetailCode(code)).toBe(valid)
    },
  )
})

describe('normalizeScanned', () => {
  it('turns iOS EAN-13 with a leading 0 into the 12-digit UPC-A', () => {
    expect(normalizeScanned('0036000291452')).toBe('036000291452')
  })

  it('applies the shared normalisation vectors', () => {
    for (const v of vectors as Vector[]) {
      if (v.normalized) expect(normalizeScanned(v.code)).toBe(v.normalized)
    }
  })

  it('trims whitespace', () => {
    expect(normalizeScanned('  7790070410122\n')).toBe('7790070410122')
  })

  it('leaves real EAN-13 (non-zero first digit), other lengths and text alone', () => {
    expect(normalizeScanned('7790070410122')).toBe('7790070410122')
    expect(normalizeScanned('00123456')).toBe('00123456')
    expect(normalizeScanned('0123456789012345')).toBe('0123456789012345')
    expect(normalizeScanned('MANUAL-1')).toBe('MANUAL-1')
  })
})

describe('manualBarcode', () => {
  it('is MANUAL- plus a timestamp, and passes the retail check untouched', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1731600000000)
    expect(manualBarcode()).toBe('MANUAL-1731600000000')
    expect(isPlausibleRetailCode(manualBarcode())).toBe(true)
    jest.restoreAllMocks()
  })
})
