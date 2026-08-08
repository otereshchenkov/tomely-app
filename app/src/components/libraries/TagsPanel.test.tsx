import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ApiError } from '#/lib/api'
import { renderWithProviders } from '#/test/render'

import { TagsPanel } from './TagsPanel'

import type { Tag } from '#/lib/tags'

function aTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'a',
    libraryId: 'lib',
    name: 'heroic',
    color: 'blue',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function panel(props: Partial<Parameters<typeof TagsPanel>[0]> = {}) {
  return (
    <TagsPanel
      tags={[aTag()]}
      onCreate={vi.fn().mockResolvedValue(undefined)}
      onUpdate={vi.fn().mockResolvedValue(undefined)}
      onDelete={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />
  )
}

describe('TagsPanel', () => {
  it('adds a tag with the colour that was picked', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)

    renderWithProviders(panel({ onCreate }))

    await user.type(screen.getByLabelText('New tag name'), 'war')
    await user.click(screen.getByRole('radio', { name: 'red' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({ name: 'war', color: 'red' }),
    )
  })

  it('adds a tag with no colour at all', async () => {
    // "No colour" is a real answer rather than a field left alone, so it is the
    // one the form starts on.
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)

    renderWithProviders(panel({ onCreate }))

    expect(
      screen
        .getByRole('radio', { name: 'No colour' })
        .getAttribute('aria-checked'),
    ).toBe('true')

    await user.type(screen.getByLabelText('New tag name'), 'omnibus')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({ name: 'omnibus', color: null }),
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

  it('edits a row in place, prefilled with its own name and colour', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn().mockResolvedValue(undefined)

    renderWithProviders(panel({ onUpdate }))

    await user.click(screen.getByRole('button', { name: 'Edit heroic' }))

    const name = screen.getByLabelText('heroic name')
    expect((name as HTMLInputElement).value).toBe('heroic')

    // Scoped to the row's own palette: the add form's is on screen too, which
    // is why the two groups are named apart.
    const palette = within(
      screen.getByRole('radiogroup', { name: 'heroic colour' }),
    )
    // The colour it already has, so a rename does not silently drop it.
    expect(
      palette.getByRole('radio', { name: 'blue' }).getAttribute('aria-checked'),
    ).toBe('true')

    await user.clear(name)
    await user.type(name, 'heroism')
    await user.click(palette.getByRole('radio', { name: 'green' }))
    await user.click(screen.getByRole('button', { name: 'Save heroic' }))

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith('a', {
        name: 'heroism',
        color: 'green',
      }),
    )
  })

  it('gives up on an edit without saving it', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn().mockResolvedValue(undefined)

    renderWithProviders(panel({ onUpdate }))

    await user.click(screen.getByRole('button', { name: 'Edit heroic' }))
    await user.type(screen.getByLabelText('heroic name'), 'x')
    await user.keyboard('{Escape}')

    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Edit heroic' })).toBeTruthy()
  })

  it('says plainly that a name is taken', async () => {
    // Rather than passing Postgres' own "duplicate key value violates unique
    // constraint" through to somebody looking at a settings page.
    const user = userEvent.setup()
    const onCreate = vi
      .fn()
      .mockRejectedValue(new ApiError(409, 'Already exists: duplicate key …'))

    renderWithProviders(panel({ onCreate }))

    await user.type(screen.getByLabelText('New tag name'), 'Heroic')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('That tag already exists.')).toBeTruthy()
  })

  it('asks before deleting a tag', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)

    renderWithProviders(panel({ onDelete }))

    await user.click(screen.getByRole('button', { name: 'Delete heroic' }))
    // The dialog, not the deletion.
    expect(onDelete).not.toHaveBeenCalled()
    expect(
      screen.getByText(/comes off every book, shelf, loan and member/),
    ).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(aTag()))
  })

  it('offers a member who may not edit nothing to press', () => {
    renderWithProviders(panel({ readOnly: true }))

    // The list is still theirs to read.
    expect(screen.getByText('heroic')).toBeTruthy()

    expect(screen.queryByLabelText('New tag name')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit heroic' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete heroic' })).toBeNull()
  })

  it('has something to say when there is nothing in it', () => {
    renderWithProviders(panel({ tags: [] }))

    expect(
      screen.getByText('Nothing here yet. Add the first one above.'),
    ).toBeTruthy()
  })

  it('says something different to a reader who cannot fix it', () => {
    renderWithProviders(panel({ tags: [], readOnly: true }))

    expect(screen.getByText('This library has no tags yet.')).toBeTruthy()
  })
})
