import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiFetch } from './api'
import { setToken } from './token'

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function headersOf(fetchMock: ReturnType<typeof mockFetch>) {
  return new Headers(fetchMock.mock.calls[0][1].headers)
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('apiFetch', () => {
  it('returns the parsed body on success', async () => {
    mockFetch(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(apiFetch('/health')).resolves.toEqual({ status: 'ok' })
  })

  it('returns undefined for a 204', async () => {
    mockFetch(new Response(null, { status: 204 }))

    await expect(apiFetch('/books/1')).resolves.toBeUndefined()
  })

  it('throws with the message the API sent', async () => {
    mockFetch(
      new Response(
        JSON.stringify({ error: 'NotFound', message: 'No such book' }),
        { status: 404 },
      ),
    )

    await expect(apiFetch('/books/1')).rejects.toThrow(
      expect.objectContaining({ status: 404, message: 'No such book' }),
    )
  })

  it('falls back to the raw body when the error is not our JSON shape', async () => {
    // e.g. a proxy or gateway failed before reaching the API
    mockFetch(new Response('502 Bad Gateway', { status: 502 }))

    await expect(apiFetch('/health')).rejects.toThrow(
      new ApiError(502, '502 Bad Gateway'),
    )
  })

  it('sends the stored token as a bearer credential', async () => {
    setToken('jwt-abc', true)
    const fetchMock = mockFetch(new Response('{}', { status: 200 }))

    await apiFetch('/auth/me')

    expect(headersOf(fetchMock).get('Authorization')).toBe('Bearer jwt-abc')
  })

  it('sends no credential at all when nobody is signed in', async () => {
    const fetchMock = mockFetch(new Response('{}', { status: 200 }))

    await apiFetch('/setup/status')

    expect(headersOf(fetchMock).has('Authorization')).toBe(false)
  })
})
