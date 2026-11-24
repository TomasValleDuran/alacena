import { expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/create-app.js'
import { prisma } from '../src/db.js'

export const api = () => request(createApp())

export const makeProduct = (over: Partial<{ barcode: string; name: string }> = {}) =>
  prisma.product.create({
    data: { barcode: over.barcode ?? `7790${Math.floor(Math.random() * 1e8)}`, name: over.name ?? 'Yerba' },
  })

export const NIL_UUID = '123e4567-e89b-42d3-a456-426614174000'

const productKeys = [
  'barcode', 'blurHash', 'brand', 'categories', 'category', 'createdAt',
  'description', 'id', 'imageUrl', 'name', 'unit',
]

export function expectProductShape(p: Record<string, unknown>) {
  expect(Object.keys(p).sort()).toEqual(productKeys)
  expect(typeof p.id).toBe('string')
  expect(typeof p.barcode).toBe('string')
  expect(typeof p.name).toBe('string')
  expect(Array.isArray(p.categories)).toBe(true)
  expect(typeof p.createdAt).toBe('string')
}

export function expectStockShape(s: Record<string, unknown>) {
  expect(Object.keys(s).sort()).toEqual(['id', 'minQty', 'product', 'productId', 'quantity', 'updatedAt'])
  expect(typeof s.quantity).toBe('number')
  expect(typeof s.minQty).toBe('number')
  expect(typeof s.updatedAt).toBe('string')
  expectProductShape(s.product as Record<string, unknown>)
}

export function expectShoppingShape(s: Record<string, unknown>) {
  expect(Object.keys(s).sort()).toEqual(['checked', 'createdAt', 'id', 'name', 'product', 'productId', 'quantity'])
  expect(typeof s.quantity).toBe('number')
  expect(typeof s.checked).toBe('boolean')
  expect(typeof s.createdAt).toBe('string')
}
