import { Link } from 'react-router-dom'
import type { StockItemWithProduct } from '@/types/stock'
import { useStockStore } from '@/store/useStockStore'
import { ProductThumb } from '@/components/ProductThumb'

type StockRowProps = {
  item: StockItemWithProduct
}

export function StockRow({ item }: StockRowProps) {
  const adjustItem = useStockStore((s) => s.adjustItem)
  const empty = item.quantity <= 0
  const low = !empty && item.min_qty != null && item.min_qty > 0 && item.quantity <= item.min_qty

  return (
    <li className="animate-rise flex items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-[0_1px_2px_rgba(32,42,24,0.06)]">
      <Link
        to={`/item/${item.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl"
      >
        <ProductThumb product={item.product} className="size-14" />
        <div className="min-w-0 flex-1">
          <p className="truncate leading-snug font-semibold">{item.product.name}</p>
          {item.product.brand ? (
            <p className="text-ink-soft truncate text-sm">{item.product.brand}</p>
          ) : null}
          {empty ? (
            <span className="bg-clay-100 text-clay-700 mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold">
              Sin stock
            </span>
          ) : low ? (
            <span className="bg-honey-100 text-honey-800 mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold">
              Queda poco
            </span>
          ) : null}
        </div>
      </Link>

      <div className="border-line bg-paper flex shrink-0 items-center rounded-full border">
        <button
          type="button"
          disabled={empty}
          onClick={() => void adjustItem(item.id, -1)}
          className="text-ink grid size-10 place-items-center rounded-full text-xl font-bold transition active:scale-90 disabled:opacity-30"
          aria-label={`Restar uno a ${item.product.name}`}
        >
          −
        </button>
        <span className="min-w-9 text-center font-mono text-base font-semibold tabular-nums">
          {item.quantity}
        </span>
        <button
          type="button"
          onClick={() => void adjustItem(item.id, 1)}
          className="bg-pine-800 grid size-10 place-items-center rounded-full text-xl font-bold text-card transition active:scale-90"
          aria-label={`Sumar uno a ${item.product.name}`}
        >
          +
        </button>
      </div>
    </li>
  )
}
