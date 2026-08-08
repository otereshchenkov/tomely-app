import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ApiError } from '#/lib/api'
import { renderWithProviders } from '#/test/render'

import { CataloguePanel } from './CataloguePanel'

import type { CatalogueEntry } from '#/lib/catalogue'

function anEntry(overrides: Partial<CatalogueEntry> = {}): CatalogueEntry {
  return {
    id: 'a',
    name: 'Novel',
    description: 'Full-length fiction or non-fiction book',
    bookCount: 0,
    ...overrides,
  }
}

function panel(props: Partial<Parameters<typeof CataloguePanel>[0]> = {}) {
  return (
    <CataloguePanel
      entries={[anEntry()]}
      noun="media type"
      withDescription
      namePlaceholder="Display name…"
      descriptionPlaceholder="Description (optional)…"
      onCreate={vi.fn().mockResolvedValue(undefined)}
      onUpdate={vi.fn().mockResolvedValue(undefined)}
      onDelete={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />
  )
}

describe('CataloguePanel', () => {
  it('adds an entry with its description', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)

    renderWithProviders(panel({ onCreate }))

    await user.type(
      screen.getByLabelText('New media type name'),
      'Short Story Collection',
    )
    await user.type(
      screen.getByLabelText('New media type description'),
      'Anthology of short fiction by one author',
    )
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        name: 'Short Story Collection',
        description: 'Anthology of short fiction by one author',
      }),
    )
  })

  it('will not add something with no name', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)

    renderWithProviders(panel({ onCreate }))

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Name is required')).toBeTruthy()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('has no description field when the catalogue has no description', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)

    renderWithProviders(
      panel({
        withDescription: false,
        noun: 'genre',
        entries: [anEntry({ name: 'Fantasy', description: null })],
        onCreate,
      }),
    )

    expect(screen.queryByLabelText('New genre description')).toBeNull()

    await user.type(screen.getByLabelText('New genre name'), 'Slice of Life')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        name: 'Slice of Life',
        description: null,
      }),
    )
  })

  it('renames a row in place', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn().mockResolvedValue(undefined)

    renderWithProviders(panel({ onUpdate }))

    await user.click(screen.getByRole('button', { name: 'Rename Novel' }))

    const name = screen.getByLabelText('Novel name')
    // Prefilled from the row, which is what makes a rename a correction rather
    // than retyping it.
    expect((name as HTMLInputElement).value).toBe('Novel')

    await user.clear(name)
    await user.type(name, 'Novella')
    await user.click(screen.getByRole('button', { name: 'Save Novel' }))

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith('a', {
        name: 'Novella',
        description: 'Full-length fiction or non-fiction book',
      }),
    )
  })

  it('gives up on a rename without saving it', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn().mockResolvedValue(undefined)

    renderWithProviders(panel({ onUpdate }))

    await user.click(screen.getByRole('button', { name: 'Rename Novel' }))
    await user.type(screen.getByLabelText('Novel name'), 'x')
    await user.click(
      screen.getByRole('button', { name: 'Cancel renaming Novel' }),
    )

    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Rename Novel' })).toBeTruthy()
  })

  it('says plainly that a name is taken', async () => {
    // Rather than passing Postgres' own "duplicate key value violates unique
    // constraint" through to somebody looking at a settings page.
    const user = userEvent.setup()
    const onCreate = vi
      .fn()
      .mockRejectedValue(new ApiError(409, 'Already exists: duplicate key …'))

    renderWithProviders(panel({ onCreate }))

    await user.type(screen.getByLabelText('New media type name'), 'Novel')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(
      await screen.findByText('That media type already exists.'),
    ).toBeTruthy()
  })

  it('counts the books on an entry and refuses to delete it', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)

    renderWithProviders(
      panel({ entries: [anEntry({ bookCount: 1 })], onDelete }),
    )

    expect(screen.getByText('1 book')).toBeTruthy()

    const remove = screen.getByRole('button', { name: 'Delete Novel' })
    expect((remove as HTMLButtonElement).disabled).toBe(true)

    await user.click(remove)
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('asks before deleting one nothing points at', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)

    renderWithProviders(panel({ onDelete }))

    expect(screen.queryByText('1 book')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Delete Novel' }))
    // The dialog, not the deletion.
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(anEntry()))
  })

  it('has something to say when there is nothing in it', () => {
    renderWithProviders(panel({ entries: [] }))

    expect(
      screen.getByText('Nothing here yet. Add the first one above.'),
    ).toBeTruthy()
  })
})
