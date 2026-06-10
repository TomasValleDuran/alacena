/**
 * Mod-10 check-digit validation for retail barcodes (EAN-8, UPC-A, EAN-13).
 * Codes that aren't shaped like these (non-numeric or other lengths) are not
 * judged — internal store codes and manual entries pass through untouched.
 *
 * A failing check means the code cannot exist on any real product: it's a
 * scanner misread (this catches dropped/shifted digits a buggy decoder emits).
 */
export function isPlausibleRetailCode(raw: string): boolean {
  if (!/^\d+$/.test(raw)) return true
  if (raw.length !== 8 && raw.length !== 12 && raw.length !== 13) return true

  const digits = [...raw].map(Number)
  const check = digits.pop()!
  // weight 3 starts at the digit immediately left of the check digit
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}
