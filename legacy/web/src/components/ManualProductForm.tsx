import { useState } from 'react'
import type { FormEvent } from 'react'

type ManualProductFormProps = {
  barcode: string
  onCancel: () => void
  onSave: (name: string, quantity: number) => void | Promise<void>
}

export function ManualProductForm({ barcode, onCancel, onSave }: ManualProductFormProps) {
  const [name, setName] = useState('')
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || qty < 1) return
    setBusy(true)
    try {
      await onSave(trimmed, qty)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Producto no encontrado</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Código: <span className="font-mono text-zinc-800">{barcode}</span>
        </p>
      </div>
      <label className="block text-sm font-medium text-zinc-700">
        Nombre
        <input
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-base outline-none ring-green-700 focus:ring-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Arroz 1kg"
          autoFocus
          required
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Cantidad inicial
        <input
          type="number"
          min={1}
          step={1}
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-base outline-none ring-green-700 focus:ring-2"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium text-zinc-800 active:bg-zinc-50"
        >
          Volver
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-xl bg-green-800 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
