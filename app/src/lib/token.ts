/**
 * Where the JWT lives in the browser.
 *
 * Its own module rather than part of `auth.tsx`, because `api.ts` needs to read
 * the token to set the Authorization header and `auth.tsx` needs `api.ts` to
 * fetch the user - putting the store in either one would make them import each
 * other.
 */

const STORAGE_KEY = 'tomely.token'

/**
 * Read the stored token, or null.
 *
 * Returns null during SSR rather than throwing: the app renders on the server
 * before any client session exists, so "no token" is the correct answer there,
 * and it is what keeps server-rendered requests anonymous by construction.
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return (
    window.localStorage.getItem(STORAGE_KEY) ??
    window.sessionStorage.getItem(STORAGE_KEY)
  )
}

/**
 * `remember` is the whole difference between the two storages: localStorage
 * survives closing the browser, sessionStorage does not. The API issues a token
 * whose expiry matches the same choice, so the two cannot drift apart.
 */
export function setToken(token: string, remember: boolean) {
  if (typeof window === 'undefined') return
  clearToken()
  const storage = remember ? window.localStorage : window.sessionStorage
  storage.setItem(STORAGE_KEY, token)
}

export function clearToken() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  window.sessionStorage.removeItem(STORAGE_KEY)
}
