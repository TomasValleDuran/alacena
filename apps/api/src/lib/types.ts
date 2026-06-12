/** Shape returned by a barcode lookup, ready to insert into `products`. */
export type ProductInsert = {
  barcode: string
  name: string
  brand?: string | null
  imageUrl?: string | null
  category?: string | null
  unit?: string | null
}
