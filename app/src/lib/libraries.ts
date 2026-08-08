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

import type { QueryClient } from '@tanstack/react-query'

/**
 * What a member may do in a library.
 *
 * The values of the `library_role` Postgres type (m0004) and of `LibraryRole` in
 * `src/entities/sea_orm_active_enums.rs`, spelled the same on the wire. They carry
 * the `library_` prefix because they say what somebody may do *in a library* - an
 * instance-level role is a different question about a different scope.
 */
export type LibraryRole = 'library_owner' | 'library_editor' | 'library_viewer'

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
  /** The caller's role in this library, not a property of the library itself.
   *  `library_owner` is the one that may rename or delete it - see `canManage`. */
  role: LibraryRole
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

/**
 * The two things anyone may change about a library.
 *
 * Both, every time - `PUT /libraries/{id}` replaces both - and `null` rather
 * than `undefined` for "no description". `undefined` would drop the key from
 * the JSON and mean the same thing only by accident of the API's
 * `#[serde(default)]`; saying it out loud does not depend on that.
 *
 * `NewLibrary` uses `undefined` for the same field because creating a library
 * genuinely omits it. Clearing a description and never having had one are
 * different requests, even though they leave the same row.
 */
export interface UpdateLibrary {
  name: string
  description: string | null
}

export function updateLibrary(
  id: string,
  input: UpdateLibrary,
): Promise<Library> {
  return apiFetch<Library>(`/libraries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** Answers 204, so there is nothing to hand back. */
export function deleteLibrary(id: string): Promise<void> {
  return apiFetch<void>(`/libraries/${id}`, { method: 'DELETE' })
}

/**
 * Whether the caller may rename or delete this library.
 *
 * The role, never `isPrimaryOwner`: the primary owner holds an ordinary owner
 * membership like anyone else and the API checks the membership. Reading
 * `ownerId` instead would hide controls the server would have allowed, the
 * moment a library can be shared with a second owner.
 *
 * This decides what to *offer*. It is not the rule - the API is - and a client
 * that gets it wrong gets a 403, not its own way.
 *
 * `undefined` while the library is still loading, which is the same as no.
 */
export function canManage(library: Library | undefined): boolean {
  return library?.role === 'library_owner'
}

/** The order `GET /libraries` returns, so a locally added one lands where the
 *  server would have put it and the list does not jump on the next fetch. */
export function byName(a: Library, b: Library): number {
  return a.name.localeCompare(b.name)
}

/**
 * Put a changed library into both caches.
 *
 * There are two - the list under `['libraries']` and the single entry under
 * `['libraries', id]` - and writing only one leaves the other showing the old
 * name until something happens to refetch it. Re-sorted the way the API sorts,
 * so a rename moves the card to where the next fetch would put it rather than
 * leaving it to jump later.
 */
export function cacheLibrary(queryClient: QueryClient, library: Library): void {
  queryClient.setQueryData<Library>(libraryQueryKey(library.id), library)
  queryClient.setQueryData<Array<Library>>(librariesQueryKey, (previous) =>
    previous
      ?.map((existing) => (existing.id === library.id ? library : existing))
      .sort(byName),
  )
}

/**
 * Forget a library that no longer exists.
 *
 * `removeQueries` rather than writing `undefined` over the single entry:
 * anything still mounted against that key would go on holding a row the server
 * will now 404 for. Removing it outright leaves nothing to hold.
 *
 * Anything *observing* that key when this runs falls back to pending and fires
 * one doomed refetch, so a caller looking at the library it just deleted should
 * be on its way somewhere else. See the settings page.
 */
export function forgetLibrary(queryClient: QueryClient, id: string): void {
  queryClient.setQueryData<Array<Library>>(librariesQueryKey, (previous) =>
    previous?.filter((library) => library.id !== id),
  )
  queryClient.removeQueries({ queryKey: libraryQueryKey(id) })
}
