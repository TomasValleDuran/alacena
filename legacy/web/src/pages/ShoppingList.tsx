import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FormEvent } from 'react'
import type { ShoppingItem } from '@/types/shopping'
import { shoppingItemName } from '@/types/shopping'
import { useShoppingStore } from '@/store/useShoppingStore'
import { useStockStore } from '@/store/useStockStore'
import { ProductThumb } from '@/components/ProductThumb'

function isLow(quantity: number, minQty: number | null): boolean {
  return quantity <= 0 || (minQty != null && minQty > 0 && quantity <= minQty)
}

export function ShoppingList() {
  const items = useShoppingStore((s) => s.items)
  const loaded = useShoppingStore((s) => s.loaded)
  const error = useShoppingStore((s) => s.error)
  const fetchList = useShoppingStore((s) => s.fetchList)
  const generateFromLowStock = useShoppingStore((s) => s.generateFromLowStock)
  const addManual = useShoppingStore((s) => s.addManual)
  const clearChecked = useShoppingStore((s) => s.clearChecked)

  const stockItems = useStockStore((s) => s.items)
  const fetchStock = useStockStore((s) => s.fetchStock)

  const [name, setName] = useState('')
  const [qty, setQty] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [generatedMsg, setGeneratedMsg] = useState<string | null>(null)

  useEffect(() => {
    void fetchList()
    void fetchStock()
  }, [fetchList, fetchStock])

  // how many low-stock products aren't on the list yet
  const missingCount = useMemo(() => {
    const onList = new Set(items.map((i) => i.product_id).filter(Boolean))
    return stockItems.filter((i) => isLow(i.quantity, i.min_qty) && !onList.has(i.product_id))
      .length
  }, [items, stockItems])

  const pending = items.filter((i) => !i.checked)
  const done = items.filter((i) => i.checked)
  const sorted = [...pending, ...done]

  async function handleGenerate() {
    setGenerating(true)
    setGeneratedMsg(null)
    try {
      const added = await generateFromLowStock()
      setGeneratedMsg(
        added === 0
          ? 'Nada por agregar: todo lo que falta ya está en la lista.'
          : `Se agregaron ${added} producto${added === 1 ? '' : 's'}.`,
      )
      setTimeout(() => setGeneratedMsg(null), 3000)
    } finally {
      setGenerating(false)
    }
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    void addManual(name, qty)
    setName('')
    setQty(1)
  }

  return (
    <div className="flex min-h-full flex-col pb-10">
      <header className="border-line bg-paper/90 sticky top-0 z-20 border-b px-4 pt-5 pb-4 backdrop-blur">
        <div className="mx-auto w-full max-w-xl">
          <Link to="/" className="text-pine-700 -ml-1 rounded-full px-2 py-1 text-sm font-bold">
            ← Alacena
          </Link>
          <div className="mt-2 flex items-end justify-between gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight italic">
              Lista de compras
            </h1>
            <p className="text-ink-soft pb-1 text-sm">
              {pending.length} por comprar
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating || missingCount === 0}
            className="border-clay-600/40 bg-clay-100 text-clay-700 mt-4 w-full rounded-2xl border px-4 py-3 text-sm font-bold transition active:scale-[0.99] disabled:opacity-50"
          >
            {generating
              ? 'Agregando…'
              : missingCount > 0
                ? `Agregar los que faltan · ${missingCount}`
                : 'Nada por reponer'}
          </button>

          {/* manual add */}
          <form onSubmit={handleAdd} className="mt-2 flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agregar a mano (ej: Servilletas)"
              className="border-line bg-card placeholder:text-ink-soft/70 ring-pine-600 min-w-0 flex-1 rounded-full border px-4 py-2.5 text-base outline-none focus:ring-2"
            />
            <div className="border-line bg-card flex shrink-0 items-center rounded-full border">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="grid size-9 place-items-center rounded-full text-lg font-bold active:scale-90 disabled:opacity-30"
                disabled={qty <= 1}
                aria-label="Restar cantidad"
              >
                −
              </button>
              <span className="min-w-7 text-center font-mono text-base font-semibold tabular-nums">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="bg-pine-800 text-card grid size-9 place-items-center rounded-full text-lg font-bold active:scale-90"
                aria-label="Sumar cantidad"
              >
                +
              </button>
            </div>
            <button
              type="submit"
              disabled={!name.trim()}
              className="bg-pine-800 text-card shrink-0 rounded-full px-4 text-sm font-bold disabled:opacity-40"
            >
              Agregar
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4">
        {error ? (
          <p className="border-clay-600/40 bg-clay-100 text-clay-700 mb-4 rounded-2xl border px-4 py-3 text-sm font-medium">
            {error}
          </p>
        ) : null}

        {generatedMsg ? (
          <p className="animate-pop bg-pine-100 text-pine-800 mb-3 rounded-2xl px-4 py-3 text-sm font-semibold">
            {generatedMsg}
          </p>
        ) : null}

        {!loaded ? (
          <ul className="flex flex-col gap-2">
            {[0, 1, 2].map((n) => (
              <li
                key={n}
                className="border-line bg-card/60 h-16 animate-pulse rounded-2xl border"
              />
            ))}
          </ul>
        ) : items.length === 0 ? (
          <div className="animate-rise border-line mt-10 rounded-3xl border border-dashed px-6 py-14 text-center">
            <p className="font-display text-2xl italic">Lista vacía</p>
            <p className="text-ink-soft mx-auto mt-2 max-w-xs text-sm">
              Agregá lo que falta con el botón de arriba, o escribí algo a mano.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((item) => (
              <ShoppingRow key={item.id} item={item} />
            ))}
          </ul>
        )}

        {done.length > 0 ? (
          <button
            type="button"
            onClick={() => void clearChecked()}
            className="text-clay-600 mx-auto mt-6 block text-sm font-bold underline-offset-4 hover:underline"
          >
            Quitar comprados ({done.length})
          </button>
        ) : null}
      </main>
    </div>
  )
}

function ShoppingRow({ item }: { item: ShoppingItem }) {
  const setQuantity = useShoppingStore((s) => s.setQuantity)
  const toggleChecked = useShoppingStore((s) => s.toggleChecked)
  const remove = useShoppingStore((s) => s.remove)

  const name = shoppingItemName(item)

  return (
    <li
      className={`animate-rise border-line bg-card flex items-center gap-3 rounded-2xl border p-3 transition ${
        item.checked ? 'opacity-50' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => void toggleChecked(item.id)}
        className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition active:scale-90 ${
          item.checked
            ? 'bg-pine-800 border-pine-800 text-card'
            : 'border-line text-transparent'
        }`}
        aria-label={item.checked ? `Desmarcar ${name}` : `Marcar ${name} como comprado`}
        aria-pressed={item.checked}
      >
        ✓
      </button>

      {item.product ? (
        <ProductThumb product={item.product} className="size-11" />
      ) : (
        <div className="border-line bg-honey-100 text-honey-800 grid size-11 shrink-0 place-items-center rounded-xl border">
          <span className="font-display text-lg italic">{name.charAt(0).toUpperCase()}</span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className={`truncate leading-snug font-semibold ${item.checked ? 'line-through' : ''}`}>
          {name}
        </p>
        {item.product?.brand ? (
          <p className="text-ink-soft truncate text-sm">{item.product.brand}</p>
        ) : !item.product ? (
          <p className="text-ink-soft text-sm">A mano</p>
        ) : null}
      </div>

      <div className="border-line bg-paper flex shrink-0 items-center rounded-full border">
        <button
          type="button"
          disabled={item.quantity <= 1}
          onClick={() => void setQuantity(item.id, item.quantity - 1)}
          className="grid size-9 place-items-center rounded-full text-lg font-bold transition active:scale-90 disabled:opacity-30"
          aria-label={`Restar uno a ${name}`}
        >
          −
        </button>
        <span className="min-w-8 text-center font-mono text-base font-semibold tabular-nums">
          {item.quantity}
        </span>
        <button
          type="button"
          onClick={() => void setQuantity(item.id, item.quantity + 1)}
          className="bg-pine-800 text-card grid size-9 place-items-center rounded-full text-lg font-bold transition active:scale-90"
          aria-label={`Sumar uno a ${name}`}
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={() => void remove(item.id)}
        className="text-ink-soft hover:text-clay-600 grid size-8 shrink-0 place-items-center rounded-full text-lg transition"
        aria-label={`Quitar ${name} de la lista`}
      >
        ×
      </button>
    </li>
  )
}
