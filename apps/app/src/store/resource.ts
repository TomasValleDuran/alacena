import { errorMessage } from '@/lib/api'

export type Status = 'idle' | 'loading' | 'ready' | 'error'

/** The fields a list store (stock, shopping) keeps about its server copy. */
export type ResourceSlice<T> = {
  items: T[]
  status: Status
  error: string | null
  refreshing: boolean
}

/**
 * Load a list into a store. The first load shows `loading` (and an `error`
 * screen on failure); later refetches keep the last good data on screen and
 * only flag `refreshing` (pull-to-refresh) — `silent` ones change nothing
 * visible and swallow errors. A silent call before the first load is a no-op.
 */
export async function fetchInto<T>(
  set: (patch: Partial<ResourceSlice<T>>) => void,
  get: () => ResourceSlice<T>,
  load: () => Promise<T[]>,
  opts?: { silent?: boolean },
): Promise<void> {
  const first = get().status !== 'ready'
  if (opts?.silent && first) return
  set(first ? { status: 'loading', error: null } : { refreshing: !opts?.silent })
  try {
    const items = await load()
    set({ items, status: 'ready', error: null })
  } catch (e) {
    if (first) set({ status: 'error', error: errorMessage(e) })
    else if (!opts?.silent) set({ error: errorMessage(e) })
  } finally {
    set({ refreshing: false })
  }
}
