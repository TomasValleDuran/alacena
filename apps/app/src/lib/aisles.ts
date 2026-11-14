import { fold } from './text'
import type { Product } from './types'

/**
 * Supermarket aisles for grouping the pantry. Pricely tags come generic →
 * specific and the FIRST tag is the store department ("almacén", "frescos",
 * "limpieza"…), so it decides; the other tags are only a fallback because
 * they're noisy (Coca-Cola is also tagged "almacen", tallarines "huevo").
 */
export type AisleKey =
  | 'almacen'
  | 'bebidas'
  | 'frescos'
  | 'congelados'
  | 'frutas'
  | 'carnes'
  | 'panaderia'
  | 'limpieza'
  | 'perfumeria'
  | 'hogar'
  | 'mascotas'
  | 'bebes'
  | 'otros'

/** In display order. */
export const AISLES: { key: AisleKey; label: string; match: RegExp | null }[] = [
  { key: 'almacen', label: 'Almacén', match: /almac[eé]n|alimentos|desayuno|despensa|golosinas|snacks/ },
  { key: 'bebidas', label: 'Bebidas', match: /bebida|gaseosa|cerveza|vino|aguas?\b|jugo|aperitivo/ },
  { key: 'frescos', label: 'Lácteos y frescos', match: /frescos|l[aá]cteo|leche|yogur|queso|fiambre|manteca/ },
  { key: 'congelados', label: 'Congelados', match: /congelad|helado/ },
  { key: 'frutas', label: 'Frutas y verduras', match: /fruta|verdura|verduler/ },
  { key: 'carnes', label: 'Carnes y pescados', match: /carne|carnicer|pollo|pescad/ },
  { key: 'panaderia', label: 'Panadería', match: /panader|panific/ },
  { key: 'limpieza', label: 'Limpieza', match: /limpieza|lavandin|detergente/ },
  { key: 'perfumeria', label: 'Perfumería y farmacia', match: /perfumer|farmacia|cuidado personal|higiene/ },
  { key: 'hogar', label: 'Hogar y bazar', match: /hogar|bazar|ferreter|papeles|textil|librer/ },
  { key: 'mascotas', label: 'Mascotas', match: /mascota|perro|gato/ },
  { key: 'bebes', label: 'Bebés', match: /\bbeb[eé]s?\b|pañal/ },
  { key: 'otros', label: 'Otros', match: null },
]

const RULES = AISLES.filter((a) => a.match).map((a) => ({ key: a.key, re: new RegExp(fold(a.match!.source)) }))

function classify(tag: string): AisleKey | null {
  const t = fold(tag)
  return RULES.find((r) => r.re.test(t))?.key ?? null
}

export function aisleOf(product: Product): AisleKey {
  const tags = product.categories ?? []
  if (tags.length === 0) return 'otros'
  // first tag = department; only if it's unrecognized, look at the rest
  return classify(tags[0]) ?? tags.slice(1).map(classify).find(Boolean) ?? 'otros'
}

export const aisleLabel = (key: AisleKey) => AISLES.find((a) => a.key === key)!.label
export const aisleOrder = (key: AisleKey) => AISLES.findIndex((a) => a.key === key)
