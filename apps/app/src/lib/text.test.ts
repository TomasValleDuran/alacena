import { fold, normalizeText } from './text'

describe('fold', () => {
  it('lowercases and strips diacritics', () => {
    expect(fold('Almacén')).toBe('almacen')
    expect(fold('PAÑAL Bebé')).toBe('panal bebe')
    expect(fold('Güemes')).toBe('guemes')
  })

  it('leaves whitespace untouched', () => {
    expect(fold('  a   b ')).toBe('  a   b ')
  })
})

describe('normalizeText', () => {
  it('also collapses whitespace runs and trims', () => {
    expect(normalizeText('  Aceite \t  Girasol\n')).toBe('aceite girasol')
  })

  it('handles empty input', () => {
    expect(normalizeText('   ')).toBe('')
  })
})
