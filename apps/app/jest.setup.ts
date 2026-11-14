// The only global mocks: native/platform modules the code imports at load time.
// Per-test mocks (e.g. `@/lib/api`) live in the test files.

jest.mock('expo-sqlite/kv-store', () => {
  const data = new Map<string, string>()
  return {
    __esModule: true,
    default: {
      getItemSync: (k: string) => data.get(k) ?? null,
      setItemSync: (k: string, v: string) => void data.set(k, v),
      removeItemSync: (k: string) => void data.delete(k),
    },
  }
})

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}))

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: undefined } },
}))
