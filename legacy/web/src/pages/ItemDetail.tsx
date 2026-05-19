import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { StockItemWithProduct } from '@/types/stock'
import { useStockStore } from '@/store/useStockStore'

type ItemDetailFormProps = {
  item: StockItemWithProduct
}

function ItemDetailForm({ item }: ItemDetailFormProps) {
  const navigate = useNavigate()
  const fetchStock = useStockStore((s) => s.fetchStock)
  const setStockQuantity = useStockStore((s) => s.setStockQuantity)
  const saveMinQty = useStockStore((s) => s.setMinQty)
  const deleteItem = useStockStore((s) => s.deleteItem)

  const [qty, setQty] = useState(String(item.quantity))
  const [minQty, setMinQtyField] = useState(String(item.min_qty ?? 0))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const p = item.product

  async function handleSave() {
    const q = Number(qty)
    const m = Number(minQty)
    if (Number.isNaN(q) || q < 0) return
    if (Number.isNaN(m) || m < 0) return
    setSaving(true)
    try {
      await setStockQuantity(item.id, q)
      await saveMinQty(item.id, m)
      await fetchStock()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este producto del stock?')) return
    setDeleting(true)
    try {
      await deleteItem(item.id)
      navigate('/')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="aspect-[4/3] w-full bg-zinc-100">
          {p.image_url ? (
            <img src={p.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400">Sin foto</div>
          )}
        </div>
        <div className="p-5">
          <h1 className="text-xl font-bold text-zinc-900">{p.name}</h1>
          {p.brand ? <p className="text-zinc-600">{p.brand}</p> : null}
          {p.category ? <p className="mt-1 text-sm text-zinc-500">{p.category}</p> : null}
          <p className="mt-2 font-mono text-xs text-zinc-400">{p.barcode}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-zinc-700">
          Cantidad
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-lg outline-none ring-green-700 focus:ring-2"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Alerta stock bajo (mín.)
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={minQty}
            onChange={(e) => setMinQtyField(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-lg outline-none ring-green-700 focus:ring-2"
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="w-full rounded-xl bg-green-800 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      <button
        type="button"
        disabled={deleting}
        onClick={() => void handleDelete()}
        className="mt-4 w-full rounded-xl border border-red-300 py-3 text-sm font-semibold text-red-800 disabled:opacity-50"
      >
        {deleting ? 'Eliminando…' : 'Eliminar del stock'}
      </button>
    </>
  )
}

export function ItemDetail() {
  const { id } = useParams<{ id: string }>()
  const items = useStockStore((s) => s.items)
  const fetchStock = useStockStore((s) => s.fetchStock)

  useEffect(() => {
    void fetchStock()
  }, [fetchStock])

  const item = items.find((i) => i.id === id)

  if (!id) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-700">ID inválido</p>
        <Link to="/" className="mt-2 inline-block text-green-800 underline">
          Volver
        </Link>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="p-4">
        <p className="text-sm text-zinc-600">Cargando o no encontrado…</p>
        <Link to="/" className="mt-2 inline-block text-green-800 underline">
          Volver al inicio
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col px-4 py-4 pb-24">
      <header className="mb-4 flex items-center gap-2">
        <Link to="/" className="text-sm font-medium text-green-900 underline-offset-2 hover:underline">
          ← Volver
        </Link>
      </header>

      <ItemDetailForm key={`${item.id}-${item.updated_at}`} item={item} />
    </div>
  )
}
