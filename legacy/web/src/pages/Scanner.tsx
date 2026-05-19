import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser'
import type { Product } from '@/types/product'
import { supabase } from '@/lib/supabase'
import { lookupBarcode } from '@/lib/openFoodFacts'
import { useStockStore } from '@/store/useStockStore'
import { ManualProductForm } from '@/components/ManualProductForm'

type Panel =
  | { type: 'live' }
  | { type: 'found'; product: Product }
  | { type: 'not_found'; barcode: string }
  | { type: 'error'; message: string }

function normalizeBarcode(raw: string): string | null {
  const b = raw.trim()
  if (b.length < 4) return null
  return b
}

export function Scanner() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const manualInputRef = useRef<HTMLInputElement>(null)
  const resolvingRef = useRef(false)

  const items = useStockStore((s) => s.items)
  const fetchStock = useStockStore((s) => s.fetchStock)
  const upsertProduct = useStockStore((s) => s.upsertProduct)
  const addOrUpdateItem = useStockStore((s) => s.addOrUpdateItem)

  const [panel, setPanel] = useState<Panel>({ type: 'live' })
  const [busy, setBusy] = useState(false)
  const [addQty, setAddQty] = useState(1)

  useEffect(() => {
    void fetchStock()
  }, [fetchStock])

  const resolveBarcode = useCallback(
    async (raw: string) => {
      const barcode = normalizeBarcode(raw)
      if (!barcode) return
      if (resolvingRef.current) return
      resolvingRef.current = true

      setBusy(true)
      try {
        const { data: cached, error: qErr } = await supabase
          .from('products')
          .select('*')
          .eq('barcode', barcode)
          .maybeSingle()

        if (qErr) {
          setPanel({ type: 'error', message: qErr.message })
          return
        }

        if (cached) {
          setPanel({ type: 'found', product: cached as Product })
          return
        }

        const off = await lookupBarcode(barcode)
        if (off) {
          const product = await upsertProduct(off)
          setPanel({ type: 'found', product })
          return
        }

        setPanel({ type: 'not_found', barcode })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Error desconocido'
        setPanel({ type: 'error', message })
      } finally {
        setBusy(false)
        resolvingRef.current = false
      }
    },
    [upsertProduct],
  )

  useEffect(() => {
    if (panel.type !== 'live') return
    const video = videoRef.current
    if (!video) return

    const reader = new BrowserMultiFormatReader()
    let cancelled = false
    let scanControls: { stop: () => void } | undefined

    reader
      .decodeFromVideoDevice(undefined, video, (result, _err, controls) => {
        if (cancelled || !result || resolvingRef.current) return
        const text = result.getText()
        controls.stop()
        void resolveBarcode(text)
      })
      .then((controls) => {
        scanControls = controls
      })
      .catch(() => {
        if (!cancelled) {
          setPanel({
            type: 'error',
            message: 'No se pudo acceder a la cámara. Probá permisos o ingresá el código a mano.',
          })
        }
      })

    return () => {
      cancelled = true
      scanControls?.stop()
      BrowserCodeReader.cleanVideoSource(video)
    }
  }, [panel.type, resolveBarcode])

  function goLive() {
    setAddQty(1)
    setPanel({ type: 'live' })
  }

  async function onManualKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const v = manualInputRef.current?.value ?? ''
    manualInputRef.current!.value = ''
    await resolveBarcode(v)
  }

  const stockQtyFor = (productId: string) =>
    items.find((i) => i.product_id === productId)?.quantity ?? null

  return (
    <div className="flex min-h-full flex-col bg-black">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-3 py-3 text-white">
        <Link
          to="/"
          className="rounded-lg px-2 py-1 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
        >
          ← Inicio
        </Link>
        <h1 className="text-lg font-semibold">Escanear</h1>
      </header>

      <div className="relative flex min-h-[50vh] flex-1 flex-col">
        {panel.type === 'live' ? (
          <>
            <video
              ref={videoRef}
              className="h-full min-h-[40vh] w-full flex-1 object-cover"
              muted
              playsInline
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-48 w-[85%] max-w-md rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            </div>
            {busy ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <p className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white">Buscando…</p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-950 px-4 py-8">
            {panel.type === 'found' ? (
              <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 text-white shadow-xl">
                <div className="flex gap-4">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                    {panel.product.image_url ? (
                      <img
                        src={panel.product.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                        Sin foto
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{panel.product.name}</p>
                    {panel.product.brand ? (
                      <p className="text-sm text-zinc-400">{panel.product.brand}</p>
                    ) : null}
                    <p className="mt-2 font-mono text-xs text-zinc-500">{panel.product.barcode}</p>
                    <p className="mt-2 text-sm text-zinc-300">
                      En alacena:{' '}
                      <span className="font-bold text-white">
                        {stockQtyFor(panel.product.id) ?? 0}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      try {
                        await addOrUpdateItem(panel.product, 1)
                        await fetchStock()
                        goLive()
                      } catch (e) {
                        setPanel({
                          type: 'error',
                          message: e instanceof Error ? e.message : 'Error al guardar',
                        })
                      } finally {
                        setBusy(false)
                      }
                    }}
                    className="w-full rounded-xl bg-green-700 py-3 text-sm font-semibold text-white active:bg-green-800 disabled:opacity-50"
                  >
                    +1 rápido
                  </button>
                  <div className="flex items-end gap-2">
                    <label className="flex flex-1 flex-col text-xs text-zinc-400">
                      Sumar cantidad
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={addQty}
                        onChange={(e) => setAddQty(Number(e.target.value))}
                        className="mt-1 rounded-xl border border-zinc-600 bg-zinc-800 px-3 py-2 text-base text-white"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy || addQty < 1}
                      onClick={async () => {
                        setBusy(true)
                        try {
                          await addOrUpdateItem(panel.product, addQty)
                          await fetchStock()
                          goLive()
                        } catch (e) {
                          setPanel({
                            type: 'error',
                            message: e instanceof Error ? e.message : 'Error al guardar',
                          })
                        } finally {
                          setBusy(false)
                        }
                      }}
                      className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 disabled:opacity-50"
                    >
                      Agregar
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={goLive}
                    className="w-full rounded-xl border border-zinc-600 py-2.5 text-sm font-medium text-zinc-200"
                  >
                    Escanear otro
                  </button>
                </div>
              </div>
            ) : null}

            {panel.type === 'not_found' ? (
              <ManualProductForm
                barcode={panel.barcode}
                onCancel={goLive}
                onSave={async (name, quantity) => {
                  const product = await upsertProduct({
                    barcode: panel.barcode,
                    name,
                  })
                  await addOrUpdateItem(product, quantity)
                  await fetchStock()
                  goLive()
                }}
              />
            ) : null}

            {panel.type === 'error' ? (
              <div className="w-full max-w-md rounded-2xl border border-red-800 bg-red-950/80 p-5 text-red-100">
                <p className="font-medium">{panel.message}</p>
                <button
                  type="button"
                  onClick={goLive}
                  className="mt-4 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-red-900"
                >
                  Reintentar
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-30 border-t border-zinc-800 bg-zinc-950 p-4">
        <label className="mx-auto block max-w-lg text-xs font-medium text-zinc-400">
          Código manual o lector USB (Enter para buscar)
          <input
            ref={manualInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ej: 7790895000999"
            onKeyDown={(e) => void onManualKeyDown(e)}
            className="mt-2 w-full rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-3 font-mono text-base text-white outline-none ring-green-600 focus:ring-2"
          />
        </label>
        <button
          type="button"
          className="mx-auto mt-3 block w-full max-w-lg rounded-xl border border-zinc-600 py-2 text-sm text-zinc-300"
          onClick={() => navigate('/')}
        >
          Volver al inicio
        </button>
      </div>
    </div>
  )
}
