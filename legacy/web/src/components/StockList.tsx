import { useMemo } from 'react'
import type { StockItemWithProduct } from '@/types/stock'
import { StockItem } from '@/components/StockItem'

type StockListProps = {
  items: StockItemWithProduct[]
  query: string
}

export function StockList({ items, query }: StockListProps) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) =>
        i.product.name.toLowerCase().includes(q) ||
        (i.product.brand?.toLowerCase().includes(q) ?? false),
    )
  }, [items, query])

  if (filtered.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
        {items.length === 0
          ? 'Tu alacena está vacía. Escaneá o cargá un código para empezar.'
          : 'No hay productos que coincidan con la búsqueda.'}
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {filtered.map((item) => (
        <StockItem key={item.id} item={item} />
      ))}
    </ul>
  )
}
