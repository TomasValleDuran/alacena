/** Lowercase and strip diacritics ("Café" → "cafe"). Whitespace is left alone. */
export const fold = (s: string): string =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** `fold`, plus runs of whitespace collapsed to one space and the ends trimmed. */
export const normalizeText = (s: string): string => fold(s).replace(/\s+/g, ' ').trim()
