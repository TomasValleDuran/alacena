import type { StockItemWithProduct } from '@/types/stock'
import { Link } from 'react-router-dom'
import { useStockStore } from '@/store/useStockStore'

type StockItemProps = {
  item: StockItemWithProduct
}

export function StockItem({ item }: StockItemProps) {
  const incrementItem = useStockStore((s) => s.incrementItem)
  const decrementItem = useStockStore((s) => s.decrementItem)
  const low = item.min_qty != null && item.quantity <= item.min_qty

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <Link to={`/item/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
          {item.product.image_url ? (
            <img
              src={item.product.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
              Sin foto
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-zinc-900">{item.product.name}</p>
          {item.product.brand ? (
            <p className="truncate text-sm text-zinc-500">{item.product.brand}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-green-900">
              {item.quantity}
              {item.product.unit ? ` ${item.product.unit}` : ''}
            </span>
            {low ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                Stock bajo
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          onClick={() => void incrementItem(item.id)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-800 text-lg font-bold text-white active:bg-green-900"
          aria-label="Aumentar cantidad"
        >
          +
        </button>
        <button
          type="button"
          disabled={item.quantity <= 0}
          onClick={() => void decrementItem(item.id)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-300 text-lg font-bold text-zinc-800 disabled:opacity-40"
          aria-label="Disminuir cantidad"
        >
          −
        </button>
      </div>
    </li>
  )
}
