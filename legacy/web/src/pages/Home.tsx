import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStockStore } from '@/store/useStockStore'
import { StockRow } from '@/components/StockRow'

type Filter = 'all' | 'low'

export function Home() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const items = useStockStore((s) => s.items)
  const loaded = useStockStore((s) => s.loaded)
  const error = useStockStore((s) => s.error)
  const fetchStock = useStockStore((s) => s.fetchStock)

  useEffect(() => {
    void fetchStock()
  }, [fetchStock])

  const lowCount = useMemo(
    () =>
      items.filter(
        (i) =>
          i.quantity <= 0 || (i.min_qty != null && i.min_qty > 0 && i.quantity <= i.min_qty),
      ).length,
    [items],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((i) => {
        if (filter === 'low') {
          const low =
            i.quantity <= 0 || (i.min_qty != null && i.min_qty > 0 && i.quantity <= i.min_qty)
          if (!low) return false
        }
        if (!q) return true
        return (
          i.product.name.toLowerCase().includes(q) ||
          (i.product.brand?.toLowerCase().includes(q) ?? false)
        )
      })
      .sort((a, b) => a.product.name.localeCompare(b.product.name, 'es'))
  }, [items, query, filter])

  return (
    <div className="flex min-h-full flex-col pb-28">
      <header className="border-line bg-paper/90 sticky top-0 z-20 border-b px-4 pt-5 pb-3 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight italic">
              Alacena
            </h1>
            <Link
              to="/lista"
              className="border-line bg-card text-pine-800 flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
            >
              <span aria-hidden>🛒</span> Lista
              {lowCount > 0 ? (
                <span className="bg-clay-600 text-card ml-0.5 rounded-full px-1.5 text-xs font-bold tabular-nums">
                  {lowCount}
                </span>
              ) : null}
            </Link>
          </div>
          <p className="text-ink-soft mt-1 text-sm">
            {items.length} producto{items.length === 1 ? '' : 's'}
            {lowCount > 0 ? (
              <>
                {' · '}
                <span className="text-clay-600 font-semibold">{lowCount} por reponer</span>
              </>
            ) : null}
          </p>

          <div className="mt-3 flex gap-2">
            <input
              type="search"
              placeholder="Buscar en la alacena…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-line bg-card placeholder:text-ink-soft/70 ring-pine-600 w-full rounded-full border px-4 py-2.5 text-base outline-none focus:ring-2"
            />
          </div>

          <div className="mt-3 flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-full px-3.5 py-1.5 font-semibold transition ${
                filter === 'all'
                  ? 'bg-pine-800 text-card'
                  : 'border-line bg-card text-ink-soft border'
              }`}
            >
              Todo
            </button>
            <button
              type="button"
              onClick={() => setFilter('low')}
              className={`rounded-full px-3.5 py-1.5 font-semibold transition ${
                filter === 'low'
                  ? 'bg-clay-600 text-card'
                  : 'border-line bg-card text-ink-soft border'
              }`}
            >
              Por reponer{lowCount > 0 ? ` · ${lowCount}` : ''}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        {error ? (
          <p className="border-clay-600/40 bg-clay-100 text-clay-700 mb-4 rounded-2xl border px-4 py-3 text-sm font-medium">
            {error}
          </p>
        ) : null}

        {!loaded ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((n) => (
              <li
                key={n}
                className="border-line bg-card/60 h-20 animate-pulse rounded-2xl border"
              />
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <div className="animate-rise border-line mt-10 rounded-3xl border border-dashed px-6 py-14 text-center">
            <p className="font-display text-2xl italic">
              {items.length === 0 ? 'Alacena vacía' : 'Nada por acá'}
            </p>
            <p className="text-ink-soft mx-auto mt-2 max-w-xs text-sm">
              {items.length === 0
                ? 'Agregá tu primer producto con el lector o escribiendo el código de barras.'
                : filter === 'low'
                  ? 'No hay productos por reponer. Buen stock.'
                  : 'Ningún producto coincide con la búsqueda.'}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visible.map((item) => (
              <StockRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </main>

      <div className="from-paper via-paper/90 fixed right-0 bottom-0 left-0 z-30 bg-gradient-to-t to-transparent px-4 pt-8 pb-5">
        <Link
          to="/add"
          className="bg-pine-800 text-card shadow-pine-900/30 active:bg-pine-900 mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-full py-4 text-base font-bold shadow-lg transition active:scale-[0.98]"
        >
          <span className="text-xl leading-none">＋</span> Agregar productos
        </Link>
      </div>
    </div>
  )
}
