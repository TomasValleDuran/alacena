import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FormEvent } from 'react'
import type { Product } from '@/types/product'
import { supabase } from '@/lib/supabase'
import { lookupBarcode } from '@/lib/openFoodFacts'
import { lookupPricely } from '@/lib/pricely'
import { isPlausibleRetailCode } from '@/lib/barcode'
import { useStockStore } from '@/store/useStockStore'
import { ProductThumb } from '@/components/ProductThumb'

type Mode = 'single' | 'multi'

type LogEntry = {
  key: number
  product: Product
  qty: number
  total: number
  undone: boolean
}

let logKey = 0

export function AddProducts() {
  const inputRef = useRef<HTMLInputElement>(null)
  const fetchStock = useStockStore((s) => s.fetchStock)
  const upsertProduct = useStockStore((s) => s.upsertProduct)
  const addToStock = useStockStore((s) => s.addToStock)

  const [mode, setMode] = useState<Mode>('single')
  const [multiQty, setMultiQty] = useState(6)
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null) // barcode awaiting manual name
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])

  const qtyPerScan = mode === 'single' ? 1 : Math.max(1, multiQty)

  // scan pipeline: codes queue up so nothing is lost while a lookup is in flight
  const queueRef = useRef<string[]>([])
  const processingRef = useRef(false)
  const pendingRef = useRef<string | null>(null)

  // burst detection: scanners "type" much faster than people
  const burstRef = useRef({ count: 0, last: 0 })
  const idleTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    void fetchStock()
  }, [fetchStock])

  // route stray keystrokes into the code input — the scanner works even if
  // the field lost focus (laptop left aside, someone tapped elsewhere)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      const editable =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      if (editable) return
      if (e.key.length === 1 || e.key === 'Enter') inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  function refocus() {
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function showPendingForm(barcode: string | null) {
    pendingRef.current = barcode
    setPending(barcode)
  }

  async function addAndLog(product: Product, qty: number) {
    const total = await addToStock(product, qty)
    setLog((l) => [{ key: ++logKey, product, qty, total, undone: false }, ...l])
  }

  async function resolveOne(barcode: string) {
    setBusyCode(barcode)
    try {
      const { data: cached, error: findErr } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle()
      if (findErr) throw new Error(findErr.message)

      let product = cached as Product | null
      if (!product) {
        // pricely.ar first (Argentine catalog), Open Food Facts as fallback
        const found = (await lookupPricely(barcode)) ?? (await lookupBarcode(barcode))
        if (found) product = await upsertProduct(found)
      }

      if (product) {
        await addAndLog(product, qtyPerScan)
        setErrorMsg(null)
      } else {
        showPendingForm(barcode)
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Algo salió mal. Probá de nuevo.')
    } finally {
      setBusyCode(null)
    }
  }

  async function processQueue() {
    if (processingRef.current) return
    processingRef.current = true
    try {
      // pause while the new-product form is open; resumes on save/cancel
      while (queueRef.current.length > 0 && pendingRef.current == null) {
        await resolveOne(queueRef.current.shift()!)
      }
    } finally {
      processingRef.current = false
    }
  }

  function submitCode(raw: string) {
    const code = raw.trim()
    if (code.length < 4) return
    if (!isPlausibleRetailCode(code)) {
      setErrorMsg(
        `El código ${code} no pasa la verificación EAN: es casi seguro una mala lectura del escáner. Escaneá de nuevo.`,
      )
      return
    }
    queueRef.current.push(code)
    void processQueue()
  }

  function onCodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    window.clearTimeout(idleTimerRef.current)
    const value = inputRef.current?.value ?? ''
    if (inputRef.current) inputRef.current.value = ''
    submitCode(value)
  }

  // scanners without an Enter suffix: a fast burst of 6+ chars followed by
  // a 120ms pause auto-submits; human-paced typing never trips this
  function onCodeInput() {
    const now = performance.now()
    const b = burstRef.current
    b.count = now - b.last > 80 ? 1 : b.count + 1
    b.last = now
    window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = window.setTimeout(() => {
      const value = inputRef.current?.value ?? ''
      if (b.count >= 6 && value.trim().length >= 6) {
        if (inputRef.current) inputRef.current.value = ''
        submitCode(value)
      }
    }, 120)
  }

  async function undo(entry: LogEntry) {
    if (entry.undone) return
    setLog((l) => l.map((e) => (e.key === entry.key ? { ...e, undone: true } : e)))
    try {
      await addToStock(entry.product, -entry.qty)
    } catch {
      setLog((l) => l.map((e) => (e.key === entry.key ? { ...e, undone: false } : e)))
    }
    refocus()
  }

  const sessionTotal = log.filter((e) => !e.undone).reduce((acc, e) => acc + e.qty, 0)

  return (
    <div className="flex min-h-full flex-col pb-10">
      <header className="border-line bg-paper/90 sticky top-0 z-20 border-b px-4 pt-5 pb-4 backdrop-blur">
        <div className="mx-auto w-full max-w-xl">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="text-pine-700 -ml-1 rounded-full px-2 py-1 text-sm font-bold"
            >
              ← Alacena
            </Link>
            {sessionTotal > 0 ? (
              <span className="bg-pine-100 text-pine-800 rounded-full px-3 py-1 text-sm font-bold">
                +{sessionTotal} esta sesión
              </span>
            ) : null}
          </div>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight italic">
            Agregar
          </h1>

          {/* mode toggle */}
          <div className="border-line bg-card mt-4 flex rounded-2xl border p-1">
            <button
              type="button"
              onClick={() => {
                setMode('single')
                refocus()
              }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                mode === 'single' ? 'bg-pine-800 text-card shadow' : 'text-ink-soft'
              }`}
            >
              De a 1
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('multi')
                refocus()
              }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                mode === 'multi' ? 'bg-pine-800 text-card shadow' : 'text-ink-soft'
              }`}
            >
              Varios por escaneo
            </button>
          </div>

          {mode === 'multi' ? (
            <div className="animate-pop border-line bg-card mt-2 flex items-center justify-between rounded-2xl border px-4 py-2">
              <p className="text-ink-soft text-sm font-medium">
                Cada escaneo suma
                <span className="text-ink font-bold"> {qtyPerScan}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMultiQty((q) => Math.max(1, q - 1))}
                  className="border-line grid size-9 place-items-center rounded-full border text-lg font-bold active:scale-90"
                  aria-label="Restar uno por escaneo"
                >
                  −
                </button>
                <span className="min-w-8 text-center font-mono text-lg font-semibold tabular-nums">
                  {qtyPerScan}
                </span>
                <button
                  type="button"
                  onClick={() => setMultiQty((q) => q + 1)}
                  className="bg-pine-800 text-card grid size-9 place-items-center rounded-full text-lg font-bold active:scale-90"
                  aria-label="Sumar uno por escaneo"
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <p className="text-ink-soft mt-2 px-1 text-sm">
              Cada escaneo suma 1 unidad. Para packs (gaseosas, latas…) usá «Varios».
            </p>
          )}

          {/* code input */}
          <div className="relative mt-3">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="Código de barras + Enter"
              onKeyDown={onCodeKeyDown}
              onInput={onCodeInput}
              className="border-pine-300 bg-card ring-pine-600 placeholder:text-ink-soft/60 placeholder:font-sans w-full rounded-2xl border-2 px-4 py-4 font-mono text-lg tracking-wide outline-none focus:ring-2"
            />
            {busyCode ? (
              <span className="text-ink-soft absolute top-1/2 right-4 -translate-y-1/2 animate-pulse text-sm font-medium">
                Buscando {busyCode}…
              </span>
            ) : null}
          </div>
          <p className="text-ink-soft mt-2 px-1 text-xs">
            Funciona con lector USB o escribiendo el código a mano.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4">
        {errorMsg ? (
          <div className="animate-pop border-clay-600/40 bg-clay-100 text-clay-700 mb-3 rounded-2xl border px-4 py-3 text-sm font-medium">
            {errorMsg}
          </div>
        ) : null}

        {pending ? (
          <NewProductForm
            barcode={pending}
            qty={qtyPerScan}
            onCancel={() => {
              showPendingForm(null)
              refocus()
              void processQueue()
            }}
            onSave={async (name, brand) => {
              const product = await upsertProduct({ barcode: pending, name, brand })
              await addAndLog(product, qtyPerScan)
              showPendingForm(null)
              refocus()
              void processQueue()
            }}
          />
        ) : null}

        {log.length > 0 ? (
          <>
            <h2 className="text-ink-soft mb-2 px-1 text-xs font-bold tracking-widest uppercase">
              Recién agregados
            </h2>
            <ul className="flex flex-col gap-2">
              {log.map((entry) => (
                <li
                  key={entry.key}
                  className={`animate-rise border-line bg-card flex items-center gap-3 rounded-2xl border p-3 transition ${
                    entry.undone ? 'opacity-40' : ''
                  }`}
                >
                  <ProductThumb product={entry.product} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm leading-snug font-semibold">
                      {entry.product.name}
                    </p>
                    <p className="text-ink-soft text-sm">
                      {entry.undone ? (
                        'Deshecho'
                      ) : (
                        <>
                          <span className="text-pine-700 font-bold">+{entry.qty}</span>
                          {' · ahora tenés '}
                          <span className="font-bold">{entry.total}</span>
                        </>
                      )}
                    </p>
                  </div>
                  {!entry.undone ? (
                    <button
                      type="button"
                      onClick={() => void undo(entry)}
                      className="text-clay-600 shrink-0 rounded-full px-3 py-1.5 text-sm font-bold"
                    >
                      Deshacer
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : !pending ? (
          <div className="text-ink-soft mt-8 text-center text-sm">
            <p className="font-display text-ink text-xl italic">Listo para escanear</p>
            <p className="mx-auto mt-2 max-w-xs">
              Lo que agregues va a aparecer acá, con la opción de deshacer si te pasaste.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setErrorMsg(null)
            showPendingForm(`MANUAL-${Date.now()}`)
          }}
          className="text-pine-700 mx-auto mt-8 block text-sm font-bold underline-offset-4 hover:underline"
        >
          ¿Sin código de barras? Crear producto a mano
        </button>
      </main>
    </div>
  )
}

type NewProductFormProps = {
  barcode: string
  qty: number
  onCancel: () => void
  onSave: (name: string, brand: string | null) => Promise<void>
}

function NewProductForm({ barcode, qty, onCancel, onSave }: NewProductFormProps) {
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [busy, setBusy] = useState(false)
  const manual = barcode.startsWith('MANUAL-')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await onSave(trimmed, brand.trim() || null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-pop border-pine-300 bg-card mb-4 rounded-3xl border-2 p-5 shadow-lg shadow-pine-900/10"
    >
      <h2 className="font-display text-xl font-semibold italic">
        {manual ? 'Producto nuevo' : 'No lo conocemos'}
      </h2>
      <p className="text-ink-soft mt-1 text-sm">
        {manual ? (
          'Se guarda en tu catálogo para la próxima.'
        ) : (
          <>
            Código <span className="text-ink font-mono">{barcode}</span> — poné un nombre y queda
            guardado para siempre.
          </>
        )}
      </p>

      <label className="mt-4 block text-sm font-bold">
        Nombre
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Arroz largo fino 1kg"
          className="border-line ring-pine-600 mt-1 w-full rounded-xl border px-3 py-2.5 text-base font-normal outline-none focus:ring-2"
        />
      </label>
      <label className="mt-3 block text-sm font-bold">
        Marca <span className="text-ink-soft font-normal">(opcional)</span>
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Ej: Gallo"
          className="border-line ring-pine-600 mt-1 w-full rounded-xl border px-3 py-2.5 text-base font-normal outline-none focus:ring-2"
        />
      </label>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="border-line flex-1 rounded-full border py-3 text-sm font-bold"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={busy}
          className="bg-pine-800 text-card flex-1 rounded-full py-3 text-sm font-bold disabled:opacity-50"
        >
          {busy ? 'Guardando…' : `Guardar y sumar ${qty}`}
        </button>
      </div>
    </form>
  )
}
