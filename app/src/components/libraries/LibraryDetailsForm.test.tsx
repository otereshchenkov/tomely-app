import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '#/test/render'

import { LibraryDetailsForm } from './LibraryDetailsForm'

import type { Library } from '#/lib/libraries'

function aLibrary(overrides: Partial<Library> = {}): Library {
  return {
    id: '0198c0f6-0000-7000-8000-000000000001',
    name: 'Loft',
    description: 'Boxes I have not opened',
    ownerId: '0198c0f6-0000-7000-8000-000000000009',
    isPrimaryOwner: true,
    role: 'owner',
    createdAt: '2026-08-07T00:00:00Z',
    updatedAt: '2026-08-07T00:00:00Z',
    ...overrides,
  }
}

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function saved(library: Library) {
  return new Response(JSON.stringify(library), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const saveButton = () => screen.getByRole('button', { name: 'Save changes' })

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('LibraryDetailsForm', () => {
  it('arrives filled in', () => {
    renderWithProviders(<LibraryDetailsForm library={aLibrary()} />)

    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Loft')
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Description').value,
    ).toBe('Boxes I have not opened')
  })

  it('sends the changed name and description', async () => {
    const user = userEvent.setup()
    const library = aLibrary()
    const fetchMock = mockFetch(saved({ ...library, name: 'Landing' }))

    renderWithProviders(<LibraryDetailsForm library={library} />)

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Landing')
    await user.click(saveButton())

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe(`/api/libraries/${library.id}`)
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({
      name: 'Landing',
      description: 'Boxes I have not opened',
    })
  })

  it('clears a description with null rather than by leaving it out', async () => {
    // Omitting it would clear it too, but only by accident of the API's serde
    // default. This request is the one that means "no description", so it says
    // so.
    const user = userEvent.setup()
    const library = aLibrary()
    const fetchMock = mockFetch(saved({ ...library, description: null }))

    renderWithProviders(<LibraryDetailsForm library={library} />)

    await user.clear(screen.getByLabelText('Description'))
    await user.click(saveButton())

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ name: 'Loft', description: null })
  })

  it('refuses a name the API would reject anyway', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(saved(aLibrary()))

    renderWithProviders(<LibraryDetailsForm library={aLibrary()} />)

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), '   ')
    await user.click(saveButton())

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

    renderWithProviders(<LibraryDetailsForm library={aLibrary()} />)

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Landing')
    await user.click(saveButton())

    expect(await screen.findByText('Could not save the library')).toBeTruthy()
  })

  it('shows a member who is not an owner what there is, and nothing to press', () => {
    renderWithProviders(
      <LibraryDetailsForm library={aLibrary({ role: 'viewer' })} readOnly />,
    )

    expect(screen.getByLabelText<HTMLInputElement>('Name').disabled).toBe(true)
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Description').disabled,
    ).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
    expect(
      screen.getByText(
        "Only an owner can change this library's name or description.",
      ),
    ).toBeTruthy()
  })
})
