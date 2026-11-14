import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { StockItemWithProduct } from '@/types/stock'
import { useStockStore } from '@/store/useStockStore'

type StepperProps = {
  label: string
  hint?: string
  value: number
  onChange: (next: number) => void
}

function Stepper({ label, hint, value, onChange }: StepperProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div>
        <p className="font-bold">{label}</p>
        {hint ? <p className="text-ink-soft text-xs">{hint}</p> : null}
      </div>
      <div className="border-line bg-paper flex shrink-0 items-center rounded-full border">
        <button
          type="button"
          disabled={value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="grid size-11 place-items-center rounded-full text-xl font-bold transition active:scale-90 disabled:opacity-30"
          aria-label={`Restar ${label.toLowerCase()}`}
        >
          −
        </button>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value)
            onChange(Number.isNaN(n) ? 0 : Math.max(0, n))
          }}
          className="w-12 bg-transparent text-center font-mono text-lg font-semibold tabular-nums outline-none"
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="bg-pine-800 text-card grid size-11 place-items-center rounded-full text-xl font-bold transition active:scale-90"
          aria-label={`Sumar ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

function ItemDetailForm({ item }: { item: StockItemWithProduct }) {
  const navigate = useNavigate()
  const setQuantities = useStockStore((s) => s.setQuantities)
  const deleteItem = useStockStore((s) => s.deleteItem)

  const [qty, setQty] = useState(item.quantity)
  const [minQty, setMinQty] = useState(item.minQty ?? 0)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState(false)

  const p = item.product
  const dirty = qty !== item.quantity || minQty !== (item.minQty ?? 0)

  async function handleSave() {
    setSaving(true)
    try {
      await setQuantities(item.id, qty, minQty)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Sacar «${p.name}» de la alacena?`)) return
    setDeleting(true)
    try {
      await deleteItem(item.id)
      navigate('/')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="animate-rise">
      <div className="border-line bg-card overflow-hidden rounded-3xl border shadow-[0_1px_2px_rgba(32,42,24,0.06)]">
        <div className="bg-pine-50 flex aspect-[5/3] w-full items-center justify-center">
          {p.imageUrl ? (
            <img
              src={p.imageUrl}
              alt=""
              className="h-full w-full object-contain mix-blend-multiply"
            />
          ) : (
            <span className="font-display text-pine-300 text-6xl italic select-none">
              {p.name.trim().charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="p-5">
          <h1 className="font-display text-2xl leading-tight font-semibold italic">{p.name}</h1>
          {p.brand ? <p className="text-ink-soft mt-0.5 font-medium">{p.brand}</p> : null}
          <div className="text-ink-soft mt-3 flex flex-wrap items-center gap-2 text-xs">
            {p.category ? (
              <span className="bg-pine-100 text-pine-800 rounded-full px-2.5 py-1 font-bold">
                {p.category}
              </span>
            ) : null}
            {!p.barcode.startsWith('MANUAL-') ? (
              <span className="border-line rounded-full border px-2.5 py-1 font-mono">
                {p.barcode}
              </span>
            ) : (
              <span className="border-line rounded-full border px-2.5 py-1 font-bold">
                Cargado a mano
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border-line bg-card divide-line mt-4 divide-y rounded-3xl border px-5 py-2">
        <Stepper
          label="En la alacena"
          hint={p.unit ? `Unidad: ${p.unit}` : undefined}
          value={qty}
          onChange={setQty}
        />
        <Stepper
          label="Avisar cuando queden"
          hint="0 desactiva el aviso de reposición"
          value={minQty}
          onChange={setMinQty}
        />
      </div>

      <button
        type="button"
        disabled={saving || !dirty}
        onClick={() => void handleSave()}
        className="bg-pine-800 text-card mt-4 w-full rounded-full py-4 text-base font-bold transition active:scale-[0.98] disabled:opacity-40"
      >
        {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios'}
      </button>

      <button
        type="button"
        disabled={deleting}
        onClick={() => void handleDelete()}
        className="text-clay-600 mt-3 w-full rounded-full py-3 text-sm font-bold disabled:opacity-50"
      >
        {deleting ? 'Sacando…' : 'Sacar de la alacena'}
      </button>
    </div>
  )
}

export function ItemDetail() {
  const { id } = useParams<{ id: string }>()
  const items = useStockStore((s) => s.items)
  const loaded = useStockStore((s) => s.loaded)
  const fetchStock = useStockStore((s) => s.fetchStock)

  useEffect(() => {
    void fetchStock()
  }, [fetchStock])

  const item = items.find((i) => i.id === id)

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-4 pt-5 pb-10">
      <header className="mb-4">
        <Link to="/" className="text-pine-700 -ml-1 rounded-full px-2 py-1 text-sm font-bold">
          ← Alacena
        </Link>
      </header>

      {item ? (
        <ItemDetailForm key={`${item.id}-${item.updatedAt}`} item={item} />
      ) : (
        <p className="text-ink-soft mt-10 text-center text-sm">
          {loaded ? 'No encontramos este producto.' : 'Cargando…'}
        </p>
      )}
    </div>
  )
}
