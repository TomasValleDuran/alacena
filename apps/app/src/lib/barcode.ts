/**
 * Mod-10 check for retail barcodes (EAN-8, UPC-A, EAN-13). Codes of any other
 * shape (internal, MANUAL-…) pass untouched. Same rule as the backend.
 */
export function isPlausibleRetailCode(raw: string): boolean {
  if (!/^\d+$/.test(raw)) return true
  if (raw.length !== 8 && raw.length !== 12 && raw.length !== 13) return true

  const digits = [...raw].map(Number)
  const check = digits.pop()!
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

/**
 * The two platform scanners disagree on UPC-A: Android (ML Kit) reports 12
 * digits, iOS (AVFoundation) reports it as EAN-13 with a leading 0. USB
 * scanners — which filled the catalog so far — emit 12. Normalize to 12 so the
 * same can resolves to the same cached product on every device.
 */
export function normalizeScanned(data: string): string {
  const code = data.trim()
  if (/^0\d{12}$/.test(code)) return code.slice(1)
  return code
}

export function manualBarcode(): string {
  return `MANUAL-${Date.now()}`
}
