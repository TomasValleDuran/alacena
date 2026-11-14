import { product } from '@/test-utils/factories'

import { AISLES, aisleLabel, aisleOf, aisleOrder } from './aisles'

const aisle = (...categories: string[]) => aisleOf(product({ categories }))

describe('aisleOf', () => {
  it('falls back to "otros" without categories', () => {
    expect(aisleOf(product())).toBe('otros')
    expect(aisle()).toBe('otros')
  })

  it.each([
    ['almacen', 'almacen'],
    ['Almacén', 'almacen'],
    ['Desayuno y merienda', 'almacen'],
    ['Bebidas', 'bebidas'],
    ['Cervezas', 'bebidas'],
    ['Frescos', 'frescos'],
    ['Lácteos', 'frescos'],
    ['Quesos', 'frescos'],
    ['Congelados', 'congelados'],
    ['Helados', 'congelados'],
    ['Frutas y verduras', 'frutas'],
    ['Carnicería', 'carnes'],
    ['Panadería', 'panaderia'],
    ['Limpieza', 'limpieza'],
    ['Perfumería', 'perfumeria'],
    ['Bazar', 'hogar'],
    ['Mascotas', 'mascotas'],
    ['Bebés', 'bebes'],
    ['Pañales', 'bebes'],
  ])('maps the department tag %j to %s', (tag, key) => {
    expect(aisle(tag)).toBe(key)
  })

  it('lets the first tag (the store department) win over later noisy tags', () => {
    // Coca-Cola is also tagged "almacen" by pricely
    expect(aisle('bebidas', 'almacen')).toBe('bebidas')
    expect(aisle('limpieza', 'bebes')).toBe('limpieza')
  })

  it('looks at the remaining tags only when the first is unrecognized', () => {
    expect(aisle('marca-x', 'xyz', 'lacteos')).toBe('frescos')
    expect(aisle('???', 'limpieza', 'almacen')).toBe('limpieza')
  })

  it('is "otros" when nothing is recognized', () => {
    expect(aisle('varios', 'zzz')).toBe('otros')
  })

  it('does not take "bebidas" for "bebés", nor match "bebe" inside other words', () => {
    expect(aisle('Bebidas sin alcohol')).toBe('bebidas')
    expect(aisle('Embebedor')).toBe('otros')
  })
})

describe('labels and order', () => {
  it('aisleLabel gives the Spanish display name', () => {
    expect(aisleLabel('frescos')).toBe('Lácteos y frescos')
    expect(aisleLabel('otros')).toBe('Otros')
  })

  it('aisleOrder follows the AISLES list, with "otros" last', () => {
    expect(aisleOrder('almacen')).toBe(0)
    expect(aisleOrder('otros')).toBe(AISLES.length - 1)
    expect(aisleOrder('bebidas')).toBeLessThan(aisleOrder('limpieza'))
  })
})
