import { router } from 'expo-router'
import { create } from 'zustand'

import { api, errorMessage } from '@/lib/api'
import { isPlausibleRetailCode } from '@/lib/barcode'
import { feedback } from '@/lib/feedback'
import type { Product } from '@/lib/types'

import { useStock } from './stock'

/**
 * What a scan does:
 *  add   — put away groceries (+N per scan; N > 1 for packs)
 *  use   — finished/opened something (−N)
 *  check — "do I have this at home?" — no changes, just look it up
 */
export type ScanMode = 'add' | 'use' | 'check'

export type LogEntry = {
  key: number
  product: Product
  delta: number
  total: number
  undone: boolean
}

type ScanState = {
  mode: ScanMode
  perScan: number
  /** code currently being looked up */
  busy: string | null
  /** unknown code waiting for the "Producto nuevo" sheet */
  pending: string | null
  log: LogEntry[]
  checked: Product | null
  notice: { key: number; tone: 'error' | 'info'; text: string } | null

  setMode: (mode: ScanMode) => void
  setPerScan: (n: number) => void
  submit: (raw: string, source: 'camera' | 'manual') => void
  completePending: (product: Product) => Promise<void>
  cancelPending: () => void
  undo: (key: number) => Promise<void>
  dismissNotice: () => void
  clearSession: () => void
}

let seq = 0
const queue: string[] = []
let processing = false

export const useScan = create<ScanState>((set, get) => {
  function notify(tone: 'error' | 'info', text: string) {
    set({ notice: { key: ++seq, tone, text } })
  }

  /** Apply the current mode to a resolved product. */
  async function apply(product: Product) {
    const { mode, perScan } = get()
    if (mode === 'check') {
      // make sure the pantry numbers we're about to show are current
      await useStock.getState().fetch({ silent: true })
      set({ checked: product })
      feedback.detect()
      return
    }
    const delta = mode === 'add' ? perScan : -perScan
    const total = await useStock.getState().adjustProduct(product, delta)
    set({
      log: [{ key: ++seq, product, delta, total, undone: false }, ...get().log].slice(0, 50),
      notice: null,
    })
    if (mode === 'use' && total === 0) feedback.warning()
    else feedback.success()
  }

  async function processQueue() {
    if (processing) return
    processing = true
    try {
      // pauses while the new-product sheet is open; resumes on save/cancel
      while (queue.length > 0 && get().pending == null) {
        const code = queue.shift()!
        set({ busy: code })
        try {
          const product = await api.resolveProduct(code)
          if (product) {
            await apply(product)
          } else {
            set({ pending: code })
            feedback.warning()
            router.push({ pathname: '/new-product', params: { barcode: code } })
          }
        } catch (e) {
          feedback.error()
          notify('error', errorMessage(e))
        } finally {
          set({ busy: null })
        }
      }
    } finally {
      processing = false
    }
  }

  return {
    mode: 'add',
    perScan: 1,
    busy: null,
    pending: null,
    log: [],
    checked: null,
    notice: null,

    setMode: (mode) => set({ mode, checked: null, notice: null }),
    setPerScan: (n) => set({ perScan: Math.min(99, Math.max(1, Math.round(n))) }),

    submit(raw, source) {
      const code = raw.trim()
      if (code.length < 4) return
      if (!isPlausibleRetailCode(code)) {
        // the camera re-reads constantly, so a bad frame is just ignored;
        // typed codes get told why
        if (source === 'manual') {
          feedback.error()
          notify('error', `${code} no es un código válido. Revisá los números.`)
        }
        return
      }
      // no haptic here: one buzz per scan, when the result lands
      queue.push(code)
      void processQueue()
    },

    async completePending(product) {
      try {
        await apply(product)
      } finally {
        set({ pending: null })
        void processQueue()
      }
    },

    cancelPending() {
      if (get().pending == null) return
      set({ pending: null })
      void processQueue()
    },

    async undo(key) {
      const entry = get().log.find((e) => e.key === key)
      if (!entry || entry.undone) return
      const mark = (undone: boolean) =>
        set({ log: get().log.map((e) => (e.key === key ? { ...e, undone } : e)) })
      mark(true)
      try {
        await useStock.getState().adjustProduct(entry.product, -entry.delta)
        feedback.tick()
      } catch (e) {
        mark(false)
        notify('error', errorMessage(e))
      }
    },

    dismissNotice: () => set({ notice: null }),
    clearSession: () => set({ log: [], checked: null, notice: null }),
  }
})

export const MODE_COPY: Record<ScanMode, { label: string; hint: string }> = {
  add: { label: 'Guardar', hint: 'Escaneá lo que guardás' },
  use: { label: 'Usar', hint: 'Escaneá lo que terminaste' },
  check: { label: 'Consultar', hint: 'Escaneá para ver cuánto hay' },
}
