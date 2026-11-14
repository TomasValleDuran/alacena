/**
 * Factory for `jest.mock('@/lib/api', () => jest.requireActual('@/test-utils/mock-api').mockApiModule())`:
 * keeps the real ApiError/errorMessage, replaces every `api.*` method with a jest.fn.
 */
export function mockApiModule() {
  const actual = jest.requireActual('@/lib/api')
  const api = Object.fromEntries(Object.keys(actual.api).map((k) => [k, jest.fn()]))
  return { ...actual, api }
}

/** A promise you resolve/reject by hand, to control the order of "network" replies. */
export function deferred<T = void>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Let pending promise callbacks run. */
export const flush = () => new Promise<void>((r) => setImmediate(r))
