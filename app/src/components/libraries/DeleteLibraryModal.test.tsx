import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '#/test/render'

import { DeleteLibraryModal } from './DeleteLibraryModal'

import type { Library } from '#/lib/libraries'

const library: Library = {
  id: '0198c0f6-0000-7000-8000-000000000001',
  name: 'Loft',
  description: null,
  ownerId: '0198c0f6-0000-7000-8000-000000000009',
  isPrimaryOwner: true,
  role: 'library_owner',
  createdAt: '2026-08-07T00:00:00Z',
  updatedAt: '2026-08-07T00:00:00Z',
}

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const deleteButton = () => screen.getByRole('button', { name: 'Delete' })

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('DeleteLibraryModal', () => {
  it('names the library it is about', () => {
    // Which is the whole reason it takes the library rather than an id: "Delete
    // this library?", asked from a grid of six, is not a question anyone can
    // answer.
    renderWithProviders(
      <DeleteLibraryModal library={library} opened onClose={vi.fn()} />,
    )

    expect(screen.getByText('Loft')).toBeTruthy()
  })

  it('deletes and says so', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(new Response(null, { status: 204 }))
    const onDeleted = vi.fn()
    const onClose = vi.fn()

    renderWithProviders(
      <DeleteLibraryModal
        library={library}
        opened
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    )

    await user.click(deleteButton())

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(library))

    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe(`/api/libraries/${library.id}`)
    expect(init.method).toBe('DELETE')
    expect(onClose).toHaveBeenCalled()
  })

  it('asks first', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(new Response(null, { status: 204 }))
    const onClose = vi.fn()
    const onDeleted = vi.fn()

    renderWithProviders(
      <DeleteLibraryModal
        library={library}
        opened
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('says so when the API refuses', async () => {
    const user = userEvent.setup()
    mockFetch(
      new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'Only an owner can change or delete a library',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const onDeleted = vi.fn()

    renderWithProviders(
      <DeleteLibraryModal
        library={library}
        opened
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    )

    await user.click(deleteButton())

    expect(await screen.findByText('Could not delete the library')).toBeTruthy()
    expect(
      screen.getByText('Only an owner can change or delete a library'),
    ).toBeTruthy()
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
