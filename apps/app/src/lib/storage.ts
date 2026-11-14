import KVStore from 'expo-sqlite/kv-store'

/**
 * Small synchronous key/value store for preferences that should survive a
 * restart. Native: expo-sqlite's kv-store. Web: `storage.web.ts` (localStorage),
 * so expo-sqlite (wasm + SharedArrayBuffer) never reaches the web bundle.
 * Every method may throw — callers treat storage as best effort.
 */
export type SyncStorage = {
  getItemSync(key: string): string | null
  setItemSync(key: string, value: string): void
  removeItemSync(key: string): void
}

const Storage: SyncStorage = KVStore

export default Storage
