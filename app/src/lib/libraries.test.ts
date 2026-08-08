import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
  cacheLibrary,
  canManage,
  forgetLibrary,
  librariesQueryKey,
  libraryQueryKey,
} from './libraries'

import type { Library } from './libraries'

function aLibrary(overrides: Partial<Library> = {}): Library {
  return {
    id: '0198c0f6-0000-7000-8000-000000000001',
    name: 'Loft',
    description: null,
    ownerId: '0198c0f6-0000-7000-8000-000000000009',
    isPrimaryOwner: true,
    role: 'library_owner',
    createdAt: '2026-08-07T00:00:00Z',
    updatedAt: '2026-08-07T00:00:00Z',
    ...overrides,
  }
}

describe('canManage', () => {
  it('is the role, not the crown', () => {
    // An owner who did not create the library may still rename it; the primary
    // owner of one they have been demoted in may not.
    expect(
      canManage(aLibrary({ role: 'library_owner', isPrimaryOwner: false })),
    ).toBe(true)
    expect(
      canManage(aLibrary({ role: 'library_viewer', isPrimaryOwner: true })),
    ).toBe(false)
  })

  it('refuses editors and viewers', () => {
    expect(canManage(aLibrary({ role: 'library_editor' }))).toBe(false)
    expect(canManage(aLibrary({ role: 'library_viewer' }))).toBe(false)
  })

  it('says no while there is nothing to say yes about', () => {
    expect(canManage(undefined)).toBe(false)
  })
})

describe('cacheLibrary', () => {
  it('writes both the list and the single entry', () => {
    const queryClient = new QueryClient()
    const library = aLibrary()
    queryClient.setQueryData(librariesQueryKey, [library])

    const renamed = { ...library, name: 'Landing' }
    cacheLibrary(queryClient, renamed)

    expect(queryClient.getQueryData(libraryQueryKey(library.id))).toEqual(
      renamed,
    )
    expect(queryClient.getQueryData(librariesQueryKey)).toEqual([renamed])
  })

  it('re-sorts, so a rename lands where the next fetch would put it', () => {
    const queryClient = new QueryClient()
    const attic = aLibrary({ id: 'a', name: 'Attic' })
    const loft = aLibrary({ id: 'b', name: 'Loft' })
    queryClient.setQueryData(librariesQueryKey, [attic, loft])

    cacheLibrary(queryClient, { ...loft, name: 'Aardvark' })

    expect(
      queryClient
        .getQueryData<Array<Library>>(librariesQueryKey)
        ?.map((library) => library.name),
    ).toEqual(['Aardvark', 'Attic'])
  })

  it('leaves the other libraries alone', () => {
    const queryClient = new QueryClient()
    const attic = aLibrary({ id: 'a', name: 'Attic' })
    const loft = aLibrary({ id: 'b', name: 'Loft' })
    queryClient.setQueryData(librariesQueryKey, [attic, loft])

    cacheLibrary(queryClient, { ...loft, description: 'Boxes' })

    expect(
      queryClient.getQueryData<Array<Library>>(librariesQueryKey)?.[0],
    ).toEqual(attic)
  })
})

describe('forgetLibrary', () => {
  it('drops it from the list and removes its own entry', () => {
    const queryClient = new QueryClient()
    const attic = aLibrary({ id: 'a', name: 'Attic' })
    const loft = aLibrary({ id: 'b', name: 'Loft' })
    queryClient.setQueryData(librariesQueryKey, [attic, loft])
    queryClient.setQueryData(libraryQueryKey(loft.id), loft)

    forgetLibrary(queryClient, loft.id)

    expect(queryClient.getQueryData(librariesQueryKey)).toEqual([attic])
    // Removed outright rather than overwritten with undefined: anything still
    // mounted against that key would otherwise go on holding a dead row.
    expect(queryClient.getQueryData(libraryQueryKey(loft.id))).toBeUndefined()
  })
})
