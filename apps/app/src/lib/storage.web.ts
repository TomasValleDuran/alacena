import type { SyncStorage } from './storage'

/** localStorage can be missing or throw (private mode, blocked site data, no window). */
function local(): globalThis.Storage {
  if (typeof window === 'undefined' || !window.localStorage) throw new Error('localStorage unavailable')
  return window.localStorage
}

const Storage: SyncStorage = {
  getItemSync: (key) => local().getItem(key),
  setItemSync: (key, value) => local().setItem(key, value),
  removeItemSync: (key) => local().removeItem(key),
}

export default Storage
