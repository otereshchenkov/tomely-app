import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '#/test/render'

import { NewLibraryModal } from './NewLibraryModal'

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function created(name = 'My books', description: string | null = null) {
  return new Response(
    JSON.stringify({
      id: '0198c0f6-0000-7000-8000-000000000000',
      name,
      description,
      ownerId: '0198c0f6-0000-7000-8000-000000000001',
      isPrimaryOwner: true,
      role: 'owner',
      createdAt: '2026-08-07T00:00:00Z',
      updatedAt: '2026-08-07T00:00:00Z',
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } },
  )
}

const submitButton = () =>
  screen.getByRole('button', { name: 'Create library' })

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('NewLibraryModal', () => {
  it('sends the name and the description', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(created('Loft', 'Boxes I have not opened'))
    const onCreated = vi.fn()

    renderWithProviders(
      <NewLibraryModal opened onClose={vi.fn()} onCreated={onCreated} />,
    )

    await user.type(screen.getByLabelText('Name'), 'Loft')
    await user.type(
      screen.getByLabelText('Description'),
      'Boxes I have not opened',
    )
    await user.click(submitButton())

    await waitFor(() => expect(onCreated).toHaveBeenCalled())

    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/api/libraries')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      name: 'Loft',
      description: 'Boxes I have not opened',
    })
  })

  it('leaves the description out altogether when it is blank', async () => {
    // The API stores a blank description as null; not sending one says the same
    // thing without making the server trim it.
    const user = userEvent.setup()
    const fetchMock = mockFetch(created())

    renderWithProviders(<NewLibraryModal opened onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Name'), 'My books')
    await user.click(submitButton())

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ name: 'My books' })
  })

  it('refuses a name the API would reject anyway', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(created())

    renderWithProviders(<NewLibraryModal opened onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Name'), '   ')
    await user.click(submitButton())

    expect(await screen.findByText('Name is required')).toBeTruthy()
    // Rejected here, so the request is never made.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('says so when the API refuses', async () => {
    const user = userEvent.setup()
    mockFetch(
      new Response(
        JSON.stringify({ error: 'BadRequest', message: 'Name is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const onCreated = vi.fn()

    renderWithProviders(
      <NewLibraryModal opened onClose={vi.fn()} onCreated={onCreated} />,
    )

    await user.type(screen.getByLabelText('Name'), 'Loft')
    await user.click(submitButton())

    expect(await screen.findByText('Could not create the library')).toBeTruthy()
    expect(onCreated).not.toHaveBeenCalled()
  })
})
