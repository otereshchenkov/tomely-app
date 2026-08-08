/**
 * The instance's vocabulary, as the client sees it: media types and genres.
 *
 * Two resources in one module for the reason `src/routes/catalogue.rs` gives -
 * they are the same kind of thing, and the settings page draws both with the
 * same component. Everything here needs a bearer token, and `getToken()` is null
 * under SSR, so none of it may be prefetched in a route `loader`.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'

import { apiFetch } from './api'
import { useAuth } from './auth'

import type { QueryClient } from '@tanstack/react-query'

/** Matches `MediaTypeResponse` in src/routes/catalogue.rs. */
export interface MediaType {
  id: string
  name: string
  description: string | null
  bookCount: number
  createdAt: string
  updatedAt: string
}

/** Matches `GenreResponse`. A genre's name is the whole of it. */
export interface Genre {
  id: string
  name: string
  bookCount: number
  createdAt: string
  updatedAt: string
}

/**
 * What the list UI works in, so one component can draw both.
 *
 * A `MediaType` already is one. A `Genre` becomes one with a null description -
 * see `asEntries` - which is what lets `CataloguePanel` stay ignorant of which
 * catalogue it is showing.
 */
export interface CatalogueEntry {
  id: string
  name: string
  description: string | null
  bookCount: number
}

/** The editable half of an entry, as both the form and the API take it. */
export interface CatalogueDraft {
  name: string
  description: string | null
}

/**
 * The order the API returns, so a row added on the client lands where the next
 * refetch would put it. Case-insensitive, matching `lower(name)` on the server.
 */
export function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name)
}

/** Genres, widened to what the shared list draws. */
export function asEntries(genres: Array<Genre>): Array<CatalogueEntry> {
  return genres.map((genre) => ({ ...genre, description: null }))
}

// -- Media types -------------------------------------------------------------

export const mediaTypesQueryKey = ['media-types']

export const mediaTypesQuery = queryOptions({
  queryKey: mediaTypesQueryKey,
  queryFn: () => apiFetch<Array<MediaType>>('/media-types'),
})

export function useMediaTypes() {
  const { status } = useAuth()
  return useQuery({ ...mediaTypesQuery, enabled: status === 'authenticated' })
}

export function createMediaType(input: CatalogueDraft): Promise<MediaType> {
  return apiFetch<MediaType>('/media-types', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateMediaType(
  id: string,
  input: CatalogueDraft,
): Promise<MediaType> {
  return apiFetch<MediaType>(`/media-types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** Answers 204, so there is nothing to hand back. */
export function deleteMediaType(id: string): Promise<void> {
  return apiFetch<void>(`/media-types/${id}`, { method: 'DELETE' })
}

// -- Genres ------------------------------------------------------------------

export const genresQueryKey = ['genres']

export const genresQuery = queryOptions({
  queryKey: genresQueryKey,
  queryFn: () => apiFetch<Array<Genre>>('/genres'),
})

export function useGenres() {
  const { status } = useAuth()
  return useQuery({ ...genresQuery, enabled: status === 'authenticated' })
}

export function createGenre(input: CatalogueDraft): Promise<Genre> {
  return apiFetch<Genre>('/genres', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateGenre(id: string, input: CatalogueDraft): Promise<Genre> {
  return apiFetch<Genre>(`/genres/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteGenre(id: string): Promise<void> {
  return apiFetch<void>(`/genres/${id}`, { method: 'DELETE' })
}

// -- Cache -------------------------------------------------------------------

/**
 * Put a created or renamed entry into the list cache.
 *
 * Written rather than invalidated, the way `cacheLibrary` is: the response is
 * the new row, so refetching the list to learn what we were just told is a round
 * trip for nothing - and a rename that flickers back to the old name while the
 * refetch is in flight is worse than no feedback at all.
 */
export function cacheEntry<T extends { id: string; name: string }>(
  queryClient: QueryClient,
  key: Array<string>,
  entry: T,
): void {
  queryClient.setQueryData<Array<T>>(key, (previous) => {
    if (!previous) return previous

    const known = previous.some((existing) => existing.id === entry.id)

    return (
      known
        ? previous.map((existing) =>
            existing.id === entry.id ? entry : existing,
          )
        : [...previous, entry]
    ).sort(byName)
  })
}

/** Forget an entry that no longer exists. */
export function forgetEntry(
  queryClient: QueryClient,
  key: Array<string>,
  id: string,
): void {
  queryClient.setQueryData<Array<{ id: string }>>(key, (previous) =>
    previous?.filter((entry) => entry.id !== id),
  )
}
