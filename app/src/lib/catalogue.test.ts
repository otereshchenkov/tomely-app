import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
  asEntries,
  byName,
  cacheEntry,
  forgetEntry,
  genresQueryKey,
  mediaTypesQueryKey,
} from './catalogue'

import type { Genre, MediaType } from './catalogue'

function aMediaType(overrides: Partial<MediaType> = {}): MediaType {
  return {
    id: '0198c0f6-0000-7000-8000-000000000001',
    name: 'Novel',
    description: 'Full-length fiction or non-fiction book',
    bookCount: 0,
    createdAt: '2026-08-07T00:00:00Z',
    updatedAt: '2026-08-07T00:00:00Z',
    ...overrides,
  }
}

function aGenre(overrides: Partial<Genre> = {}): Genre {
  return {
    id: '0198c0f6-0000-7000-8000-000000000002',
    name: 'Fantasy',
    bookCount: 0,
    createdAt: '2026-08-07T00:00:00Z',
    updatedAt: '2026-08-07T00:00:00Z',
    ...overrides,
  }
}

describe('byName', () => {
  it('sorts the way the API does, ignoring case', () => {
    const sorted = [
      aMediaType({ name: 'manga' }),
      aMediaType({ name: 'Anthology' }),
      aMediaType({ name: 'Novel' }),
    ].sort(byName)

    expect(sorted.map((entry) => entry.name)).toEqual([
      'Anthology',
      'manga',
      'Novel',
    ])
  })
})

describe('asEntries', () => {
  it('gives a genre the description column it does not have', () => {
    // So one component can draw both catalogues without asking which it has.
    expect(asEntries([aGenre()])[0]).toMatchObject({
      name: 'Fantasy',
      description: null,
    })
  })
})

describe('cacheEntry', () => {
  it('replaces an entry that is already there', () => {
    const queryClient = new QueryClient()
    const novel = aMediaType()
    queryClient.setQueryData(mediaTypesQueryKey, [novel])

    const renamed = { ...novel, name: 'Novella' }
    cacheEntry(queryClient, mediaTypesQueryKey, renamed)

    expect(queryClient.getQueryData(mediaTypesQueryKey)).toEqual([renamed])
  })

  it('appends one that is not, in the right place', () => {
    const queryClient = new QueryClient()
    const anthology = aMediaType({ id: 'a', name: 'Anthology' })
    const novel = aMediaType({ id: 'b', name: 'Novel' })
    queryClient.setQueryData(mediaTypesQueryKey, [anthology, novel])

    cacheEntry(
      queryClient,
      mediaTypesQueryKey,
      aMediaType({
        id: 'c',
        name: 'Manga',
      }),
    )

    expect(
      queryClient
        .getQueryData<Array<MediaType>>(mediaTypesQueryKey)
        ?.map((entry) => entry.name),
    ).toEqual(['Anthology', 'Manga', 'Novel'])
  })

  it('re-sorts, so a rename lands where the next fetch would put it', () => {
    const queryClient = new QueryClient()
    const anthology = aGenre({ id: 'a', name: 'Anthology' })
    const fantasy = aGenre({ id: 'b', name: 'Fantasy' })
    queryClient.setQueryData(genresQueryKey, [anthology, fantasy])

    cacheEntry(queryClient, genresQueryKey, { ...fantasy, name: 'Action' })

    expect(
      queryClient
        .getQueryData<Array<Genre>>(genresQueryKey)
        ?.map((entry) => entry.name),
    ).toEqual(['Action', 'Anthology'])
  })

  it('does nothing when the list has not been fetched', () => {
    // Seeding a list nobody has asked for would leave a one-entry catalogue in
    // the cache for the next reader to find.
    const queryClient = new QueryClient()

    cacheEntry(queryClient, mediaTypesQueryKey, aMediaType())

    expect(queryClient.getQueryData(mediaTypesQueryKey)).toBeUndefined()
  })
})

describe('forgetEntry', () => {
  it('drops it from the list', () => {
    const queryClient = new QueryClient()
    const anthology = aGenre({ id: 'a', name: 'Anthology' })
    const fantasy = aGenre({ id: 'b', name: 'Fantasy' })
    queryClient.setQueryData(genresQueryKey, [anthology, fantasy])

    forgetEntry(queryClient, genresQueryKey, fantasy.id)

    expect(queryClient.getQueryData(genresQueryKey)).toEqual([anthology])
  })
})
