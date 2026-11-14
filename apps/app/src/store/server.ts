import { create } from 'zustand'

import { defaultApiUrl, loadApiUrl, saveApiUrl, trimSlash } from '@/lib/server'

type ServerState = {
  apiUrl: string
  isCustom: boolean
  setApiUrl: (url: string | null) => void
}

export const useServer = create<ServerState>((set) => {
  const initial = loadApiUrl()
  return {
    apiUrl: initial,
    isCustom: initial !== defaultApiUrl(),
    setApiUrl(url) {
      const value = url ? trimSlash(url) : null
      saveApiUrl(value)
      set({ apiUrl: value ?? defaultApiUrl(), isCustom: value != null })
    },
  }
})
