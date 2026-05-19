export type Product = {
  id: string
  barcode: string
  name: string
  brand: string | null
  image_url: string | null
  category: string | null
  unit: string | null
  created_at: string
}

export type ProductInsert = {
  barcode: string
  name: string
  brand?: string | null
  image_url?: string | null
  category?: string | null
  unit?: string | null
}
