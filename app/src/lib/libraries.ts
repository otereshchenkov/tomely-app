/**
 * Libraries, as the client sees them.
 *
 * Everything here needs a bearer token, and `getToken()` is null under SSR - so
 * none of it may be prefetched in a route `loader`. A server-rendered request
 * would go out anonymous and come back 401. `useLibraries` and `useLibrary`
 * therefore gate themselves on the session having resolved, the same way
 * `AuthProvider` gates `/auth/me`, and private pages render their shell on the
 * server and fill in once the client knows who is asking.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'

import { apiFetch } from './api'
import { useAuth } from './auth'

/** Matches `LibraryResponse` in src/routes/libraries.rs. */
export interface Library {
  id: string
  name: string
  description: string | null
  ownerId: string
  /** True when the caller created it. There is no permission attached to this
   *  yet - an owner and the primary owner may do the same things - it is what
   *  puts the crown on the card. */
  isPrimaryOwner: boolean
  /** The caller's role in this library, not a property of the library itself. */
  role: 'owner' | 'editor' | 'viewer'
  createdAt: string
  updatedAt: string
}

export const librariesQueryKey = ['libraries']

export const librariesQuery = queryOptions({
  queryKey: librariesQueryKey,
  queryFn: () => apiFetch<Array<Library>>('/libraries'),
})

export const libraryQueryKey = (id: string) => ['libraries', id]

export const libraryQuery = (id: string) =>
  queryOptions({
    queryKey: libraryQueryKey(id),
    queryFn: () => apiFetch<Library>(`/libraries/${id}`),
  })

/** Every library the signed-in user is a member of, by name. */
export function useLibraries() {
  const { status } = useAuth()

  return useQuery({ ...librariesQuery, enabled: status === 'authenticated' })
}

export function useLibrary(id: string) {
  const { status } = useAuth()

  return useQuery({ ...libraryQuery(id), enabled: status === 'authenticated' })
}

export interface NewLibrary {
  name: string
  description?: string
}

export function createLibrary(input: NewLibrary): Promise<Library> {
  return apiFetch<Library>('/libraries', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** The order `GET /libraries` returns, so a locally added one lands where the
 *  server would have put it and the list does not jump on the next fetch. */
export function byName(a: Library, b: Library): number {
  return a.name.localeCompare(b.name)
}
