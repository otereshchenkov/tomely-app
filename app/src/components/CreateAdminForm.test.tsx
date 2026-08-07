import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '#/test/render'

import { CreateAdminForm } from './CreateAdminForm'

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function session() {
  return new Response(
    JSON.stringify({
      token: 'jwt-abc',
      expiresAt: '2026-09-06T00:00:00Z',
      user: {
        id: '0198c0f6-0000-7000-8000-000000000000',
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        isInstanceAdmin: true,
      },
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } },
  )
}

/** Fill the form out and submit it. */
async function submit(
  user: ReturnType<typeof userEvent.setup>,
  {
    password = 'a good password',
    confirmPassword = password,
  }: { password?: string; confirmPassword?: string } = {},
) {
  await user.type(screen.getByLabelText('Display name'), 'Jane Doe')
  await user.type(screen.getByLabelText('Email'), 'jane@example.com')
  await user.type(screen.getByLabelText('Password'), password)
  await user.type(screen.getByLabelText('Confirm password'), confirmPassword)
  await user.click(screen.getByRole('button', { name: 'Create admin account' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('CreateAdminForm', () => {
  it('has no username field - a user is identified by their email', () => {
    renderWithProviders(<CreateAdminForm onCreated={vi.fn()} />)

    expect(screen.queryByLabelText(/username/i)).toBeNull()
    expect(screen.getByLabelText('Email')).toBeTruthy()
  })

  it('refuses a password the API would reject anyway', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(session())
    renderWithProviders(<CreateAdminForm onCreated={vi.fn()} />)

    await submit(user, { password: 'short' })

    expect(await screen.findByText('Use at least 8 characters')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a confirmation that does not match', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(session())
    renderWithProviders(<CreateAdminForm onCreated={vi.fn()} />)

    await submit(user, { confirmPassword: 'a typo password' })

    expect(
      await screen.findByText('The two passwords do not match'),
    ).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('creates the account, keeps the token, and moves on', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(session())
    const onCreated = vi.fn()
    renderWithProviders(<CreateAdminForm onCreated={onCreated} />)

    await submit(user)

    await waitFor(() => expect(onCreated).toHaveBeenCalled())

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      displayName: 'Jane Doe',
      email: 'jane@example.com',
      password: 'a good password',
    })

    // Setup signs the owner in, and does so persistently - step two's "Go to
    // dashboard" has to land authenticated.
    expect(window.localStorage.getItem('tomely.token')).toBe('jwt-abc')
  })

  it('surfaces the reason the API gave when it refuses', async () => {
    const user = userEvent.setup()
    mockFetch(
      new Response(
        JSON.stringify({
          error: 'Conflict',
          message: 'This instance is already set up',
        }),
        { status: 409 },
      ),
    )
    const onCreated = vi.fn()
    renderWithProviders(<CreateAdminForm onCreated={onCreated} />)

    await submit(user)

    expect(
      await screen.findByText('This instance is already set up'),
    ).toBeTruthy()
    expect(onCreated).not.toHaveBeenCalled()
  })
})
