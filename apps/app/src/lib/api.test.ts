import { api, ApiError } from './api'

const UNEXPECTED = 'El servidor respondió algo inesperado. Revisá la dirección en Ajustes.'

function reply(status: number, body: string) {
  global.fetch = jest.fn().mockResolvedValue({
    status,
    text: () => Promise.resolve(body),
  }) as unknown as typeof fetch
}

describe('unexpected success bodies', () => {
  it('an HTML page on a list endpoint is an ApiError, not items: null', async () => {
    reply(200, '<!doctype html><html></html>')
    const e = await api.getStock().catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e.message).toBe(UNEXPECTED)
    await expect(api.getShopping()).rejects.toThrow(UNEXPECTED)
  })

  it('JSON that is not an array on a list endpoint is an ApiError', async () => {
    reply(200, '{"ok":true}')
    await expect(api.getStock()).rejects.toThrow(UNEXPECTED)
    reply(200, 'null')
    await expect(api.getShopping()).rejects.toThrow(UNEXPECTED)
  })

  it('an empty 200 on an endpoint that returns data is an ApiError', async () => {
    reply(200, '')
    await expect(api.addStock('p', 1)).rejects.toThrow(UNEXPECTED)
  })

  it('non-JSON from resolve is an ApiError; a real 404 is still null', async () => {
    reply(200, '<html></html>')
    await expect(api.resolveProduct('7790000000000')).rejects.toThrow(UNEXPECTED)
    reply(404, '{"found":false}')
    await expect(api.resolveProduct('7790000000000')).resolves.toBeNull()
  })

  it('health only passes for the API own JSON', async () => {
    reply(200, '<html></html>')
    await expect(api.health('http://x')).resolves.toBe(false)
    reply(200, '{"ok":true}')
    await expect(api.health('http://x')).resolves.toBe(true)
  })
})

describe('normal responses', () => {
  it('arrays, objects and 204 pass through', async () => {
    reply(200, '[]')
    await expect(api.getStock()).resolves.toEqual([])
    reply(200, '{"quantity":3}')
    await expect(api.addStock('p', 1)).resolves.toBe(3)
    reply(204, '')
    await expect(api.deleteStock('x')).resolves.not.toThrow()
  })

  it('errors keep the server message, or fall back to the status', async () => {
    reply(400, '{"error":"mal"}')
    await expect(api.getStock()).rejects.toThrow('mal')
    reply(502, '<html>bad gateway</html>')
    await expect(api.getStock()).rejects.toThrow('Error 502')
  })

  it('a network failure says there is no connection', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('x')) as unknown as typeof fetch
    await expect(api.getStock()).rejects.toThrow('No hay conexión con el servidor.')
  })
})
