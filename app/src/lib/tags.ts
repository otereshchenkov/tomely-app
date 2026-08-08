/**
 * A library's own tags, as the client sees it.
 *
 * Its own module rather than a corner of `catalogue.ts`: a media type and a
 * genre belong to the instance and a tag belongs to one library, so nothing
 * about the fetching is shared - the path carries a library id and the cache key
 * has to as well. The cache *helpers* are shared, because they never cared what
 * they were holding.
 *
 * Everything here needs a bearer token, and `getToken()` is null under SSR, so
 * none of it may be prefetched in a route `loader`.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'

import { apiFetch } from './api'
import { useAuth } from './auth'

/** Matches `TagResponse` in src/routes/tags.rs. */
export interface Tag {
  id: string
  libraryId: string
  name: string
  /** A Mantine colour name, or null for a tag that has not been given one. */
  color: string | null
  createdAt: string
  updatedAt: string
}

/** The editable half of a tag, as both the form and the API take it. */
export interface TagDraft {
  name: string
  color: string | null
}

/**
 * The palette, in the order the swatches are drawn.
 *
 * Mantine's own colour names, so a swatch is `var(--mantine-color-{name}-6)` and
 * a tag drawn with one is right in both themes without this list knowing which
 * theme it is in. `COLORS` in `src/routes/tags.rs` is the same fourteen names,
 * and the API refuses anything not on it - so adding one here alone gets a 400.
 */
export const TAG_COLORS = [
  'red',
  'orange',
  'yellow',
  'lime',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'grape',
  'pink',
  'gray',
  'dark',
] as const

export type TagColor = (typeof TAG_COLORS)[number]

/** The CSS variable a colour name draws as. Shade 6 is Mantine's "filled". */
export function swatch(color: string): string {
  return `var(--mantine-color-${color}-6)`
}

/**
 * Nested under the library's own key on purpose: `forgetLibrary` removes
 * everything below `['libraries', id]`, so a deleted library takes its tags out
 * of the cache with nothing here having to be told.
 */
export const tagsQueryKey = (libraryId: string) => [
  'libraries',
  libraryId,
  'tags',
]

export const tagsQuery = (libraryId: string) =>
  queryOptions({
    queryKey: tagsQueryKey(libraryId),
    queryFn: () => apiFetch<Array<Tag>>(`/libraries/${libraryId}/tags`),
  })

export function useTags(libraryId: string) {
  const { status } = useAuth()
  return useQuery({
    ...tagsQuery(libraryId),
    enabled: status === 'authenticated',
  })
}

export function createTag(libraryId: string, input: TagDraft): Promise<Tag> {
  return apiFetch<Tag>(`/libraries/${libraryId}/tags`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateTag(
  libraryId: string,
  id: string,
  input: TagDraft,
): Promise<Tag> {
  return apiFetch<Tag>(`/libraries/${libraryId}/tags/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** Answers 204, so there is nothing to hand back. */
export function deleteTag(libraryId: string, id: string): Promise<void> {
  return apiFetch<void>(`/libraries/${libraryId}/tags/${id}`, {
    method: 'DELETE',
  })
}
