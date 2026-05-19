import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StockList } from '@/components/StockList'
import { useStockStore } from '@/store/useStockStore'

export function Home() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const items = useStockStore((s) => s.items)
  const loading = useStockStore((s) => s.loading)
  const error = useStockStore((s) => s.error)
  const fetchStock = useStockStore((s) => s.fetchStock)

  useEffect(() => {
    void fetchStock()
  }, [fetchStock])

  return (
    <div className="flex min-h-full flex-col pb-24">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-green-900">Mi alacena</h1>
          <button
            type="button"
            onClick={() => void fetchStock()}
            className="rounded-lg px-2 py-1 text-sm font-medium text-green-800 underline-offset-2 hover:underline"
          >
            Actualizar
          </button>
        </div>
        <div className="mx-auto mt-3 max-w-lg">
          <input
            type="search"
            placeholder="Buscar por nombre…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-base outline-none ring-green-700 focus:ring-2"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4">
        {loading && items.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">Cargando…</p>
        ) : null}
        {error ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <StockList items={items} query={query} />
      </main>

      <Link
        to="/scanner"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-green-800 text-3xl font-light text-white shadow-lg shadow-green-900/30 active:scale-95"
        aria-label="Abrir escáner"
      >
        +
      </Link>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-200 bg-white/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-lg justify-around text-sm">
          <span className="font-semibold text-green-900">Inicio</span>
          <button
            type="button"
            className="font-medium text-zinc-600"
            onClick={() => navigate('/scanner')}
          >
            Escanear
          </button>
        </div>
      </nav>
    </div>
  )
}
