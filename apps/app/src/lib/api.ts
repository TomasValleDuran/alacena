import { useServer } from '@/store/server'

import type { Insights, Product, ShoppingRow, StockRow } from './types'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null, // null = never reached the server
  ) {
    super(message)
  }
}

const TIMEOUT_MS = 12_000

/** fetch → JSON, with a timeout and Spanish messages the UI can show as-is. */
async function call(
  path: string,
  init?: RequestInit,
  baseOverride?: string,
): Promise<{ status: number; data: any }> {
  const base = baseOverride ?? useServer.getState().apiUrl
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new ApiError('No hay conexión con el servidor.', null)
  } finally {
    clearTimeout(timer)
  }
  const text = res.status === 204 ? '' : await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // non-JSON body (proxy error page, wrong server…)
  }
  return { status: res.status, data }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { status, data } = await call(`/api${path}`, init)
  if (status >= 400) throw new ApiError(data?.error ?? `Error ${status}`, status)
  return data as T
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

export const api = {
  async health(baseOverride?: string): Promise<boolean> {
    if (baseOverride) {
      try {
        const { status } = await call('/health', undefined, baseOverride)
        return status >= 200 && status < 300
      } catch {
        return false
      }
    }
    const { status } = await call('/health')
    return status === 200
  },

  /** cache → pricely.ar → Open Food Facts. `null` = no catalog knows it. */
  async resolveProduct(barcode: string): Promise<Product | null> {
    const { status, data } = await call('/api/products/resolve', json('POST', { barcode }))
    if (status === 404) return null
    if (status >= 400) throw new ApiError(data?.error ?? `Error ${status}`, status)
    return data.product as Product
  },

  createProduct(input: { barcode: string; name: string; brand?: string | null }) {
    return request<{ product: Product }>('/products', json('POST', input)).then((r) => r.product)
  },

  /** Live prices per market + categories (pricely; may be null if it's down). */
  getInsights: (productId: string) => request<Insights>(`/products/${productId}/insights`),

  /** Server fills categories for older products (paced, max ~40 per call). */
  backfillCategories: () =>
    request<{ updated: number; remaining: number | null }>('/products/backfill-categories', json('POST')),

  getStock: () => request<StockRow[]>('/stock'),
  addStock: (productId: string, delta: number) =>
    request<{ quantity: number }>('/stock/add', json('POST', { productId, delta })).then(
      (r) => r.quantity,
    ),
  patchStock: (id: string, patch: { minQty?: number }) =>
    request<StockRow>(`/stock/${id}`, json('PATCH', patch)),
  deleteStock: (id: string) => request<void>(`/stock/${id}`, json('DELETE')),

  getShopping: () => request<ShoppingRow[]>('/shopping'),
  addShoppingText: (name: string, quantity = 1) =>
    request<ShoppingRow>('/shopping', json('POST', { name, quantity })),
  addShoppingProduct: (productId: string, quantity = 1) =>
    request<ShoppingRow>('/shopping', json('POST', { productId, quantity })),
  generateShopping: () =>
    request<{ added: number }>('/shopping/generate', json('POST')).then((r) => r.added),
  patchShopping: (id: string, patch: { quantity?: number; checked?: boolean }) =>
    request<ShoppingRow>(`/shopping/${id}`, json('PATCH', patch)),
  deleteShopping: (id: string) => request<void>(`/shopping/${id}`, json('DELETE')),
  clearCheckedShopping: () => request<void>('/shopping/checked', json('DELETE')),
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Algo salió mal.'
}
