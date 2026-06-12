export type Product = {
  id: string
  barcode: string
  name: string
  brand: string | null
  imageUrl: string | null
  category: string | null
  unit: string | null
  createdAt: string
}

export type ProductInsert = {
  barcode: string
  name: string
  brand?: string | null
  imageUrl?: string | null
  category?: string | null
  unit?: string | null
}
