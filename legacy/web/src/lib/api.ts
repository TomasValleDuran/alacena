import type { Product } from '@/types/product'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

if (!import.meta.env.VITE_API_URL) {
  console.warn('[Alacena] VITE_API_URL not set; defaulting to http://localhost:3001')
}

/** Wraps fetch: JSON in/out, throws Error(message) from the API's { error } body. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
  })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new Error((data && data.error) || `Error ${res.status}`)
  }
  return data as T
}

// Wire shape from the backend (camelCase JSON: numbers + ISO date strings).
export type StockRow = {
  id: string
  productId: string
  quantity: number
  minQty: number | null
  updatedAt: string
  product: Product
}

export type ShoppingRow = {
  id: string
  productId: string | null
  name: string | null
  quantity: number
  checked: boolean
  createdAt: string
  product: Product | null
}

export const api = {
  /** Resolve a barcode (cache → pricely → OFF). null = no catalog knows it. */
  async resolveProduct(barcode: string): Promise<Product | null> {
    const res = await fetch(`${BASE}/api/products/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode }),
    })
    if (res.status === 404) return null
    const text = await res.text()
    const data = text ? JSON.parse(text) : null
    if (!res.ok) throw new Error((data && data.error) || `Error ${res.status}`)
    return data.product as Product
  },

  createProduct(input: { barcode: string; name: string; brand?: string | null }): Promise<Product> {
    return request<{ product: Product }>('/products', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.product)
  },

  getStock(): Promise<StockRow[]> {
    return request<StockRow[]>('/stock')
  },

  addStock(productId: string, delta: number): Promise<number> {
    return request<{ quantity: number }>('/stock/add', {
      method: 'POST',
      body: JSON.stringify({ productId, delta }),
    }).then((r) => r.quantity)
  },

  patchStock(id: string, patch: { quantity?: number; minQty?: number }): Promise<StockRow> {
    return request<StockRow>(`/stock/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  },

  deleteStock(id: string): Promise<void> {
    return request<void>(`/stock/${id}`, { method: 'DELETE' })
  },

  getShopping(): Promise<ShoppingRow[]> {
    return request<ShoppingRow[]>('/shopping')
  },

  addManualShopping(name: string, quantity: number): Promise<ShoppingRow> {
    return request<ShoppingRow>('/shopping', {
      method: 'POST',
      body: JSON.stringify({ name, quantity }),
    })
  },

  generateShopping(): Promise<number> {
    return request<{ added: number }>('/shopping/generate', { method: 'POST' }).then((r) => r.added)
  },

  patchShopping(id: string, patch: { quantity?: number; checked?: boolean }): Promise<ShoppingRow> {
    return request<ShoppingRow>(`/shopping/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  },

  deleteShopping(id: string): Promise<void> {
    return request<void>(`/shopping/${id}`, { method: 'DELETE' })
  },

  clearCheckedShopping(): Promise<void> {
    return request<void>('/shopping/checked', { method: 'DELETE' })
  },
}
