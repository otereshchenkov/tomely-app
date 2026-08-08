import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '#/test/render'
import { draftFromResult, emptyDraft } from '#/lib/books'

import { BookForm } from './BookForm'

import type { BookSearchResult } from '#/lib/bookSearch'

function aResult(overrides: Partial<BookSearchResult> = {}): BookSearchResult {
  return {
    id: 'ol-devils-pawn',
    title: "The Devil's Pawn",
    subtitle: null,
    authors: ['Yvonne Whittal'],
    publishedYear: 1984,
    publisher: 'G K Hall & Co',
    coverUrl: null,
    isbn13: '9780373107827',
    isbn10: '0263748707',
    pageCount: 188,
    language: 'en',
    description: null,
    provider: 'Open Library',
    ...overrides,
  }
}

// A required field's label reads "Title *", so the exact string does not match.
const field = (label: string | RegExp) =>
  screen.getByLabelText<HTMLInputElement>(label)

// Anything built on Mantine's `Combobox` - `Select`, `MultiSelect`,
// `TagsInput` - labels both its input and its dropdown, so the label alone is
// ambiguous and the role has to say which one is wanted.
const combo = (name: string) =>
  screen.getByRole<HTMLInputElement>('combobox', { name })

// `hidden: true` because an open Mantine dropdown still carries the
// `display: none` its enter transition starts from - jsdom runs no animations,
// so it never clears - and `getByRole` would call the whole list inaccessible.
// The click lands regardless: `user-event` gates on `pointer-events`, not on
// what is painted. Real browsers, and the a11y test that would care, see an
// ordinary listbox.
const option = (name: string) =>
  screen.findByRole('option', { name, hidden: true })

const options = (name: string) =>
  screen.findAllByRole('option', { name, hidden: true }).catch(() => [])

describe('BookForm', () => {
  it('arrives blank when nothing was picked', () => {
    renderWithProviders(<BookForm initial={emptyDraft()} onCancel={vi.fn()} />)

    expect(field(/^Title/).value).toBe('')
    expect(combo('Media type').value).toBe('Novel')
    expect(field('Contributor 1 name').value).toBe('')
  })

  it('arrives filled in from a picked result', () => {
    renderWithProviders(
      <BookForm initial={draftFromResult(aResult())} onCancel={vi.fn()} />,
    )

    expect(field(/^Title/).value).toBe("The Devil's Pawn")
    expect(field('Contributor 1 name').value).toBe('Yvonne Whittal')
    expect(combo('Contributor 1 role').value).toBe('Author')
    expect(field('Publisher').value).toBe('G K Hall & Co')
    expect(field('Publish date').value).toBe('1984-01-01')
    expect(field('ISBN-13').value).toBe('9780373107827')
    expect(field('ISBN-10').value).toBe('0263748707')
    expect(field('Page count').value).toBe('188')
  })

  it('gives every author their own row', () => {
    renderWithProviders(
      <BookForm
        initial={draftFromResult(
          aResult({ authors: ['Fyodor Dostoevsky', 'David Magarshack'] }),
        )}
        onCancel={vi.fn()}
      />,
    )

    expect(field('Contributor 1 name').value).toBe('Fyodor Dostoevsky')
    expect(field('Contributor 2 name').value).toBe('David Magarshack')
  })

  it('adds and removes contributor rows', async () => {
    const user = userEvent.setup()

    renderWithProviders(<BookForm initial={emptyDraft()} onCancel={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(field('Contributor 2 name')).toBeTruthy()

    await user.click(
      screen.getByRole('button', { name: 'Remove contributor 2' }),
    )
    expect(screen.queryByLabelText('Contributor 2 name')).toBeNull()
  })

  it('lets a tag be invented on the spot', async () => {
    const user = userEvent.setup()

    renderWithProviders(<BookForm initial={emptyDraft()} onCancel={vi.fn()} />)

    await user.type(combo('Tags'), 'to reread{Enter}')

    expect(screen.getByText('to reread')).toBeTruthy()
  })

  it('offers genres from a fixed list, and takes nothing else', async () => {
    const user = userEvent.setup()

    renderWithProviders(<BookForm initial={emptyDraft()} onCancel={vi.fn()} />)

    await user.click(combo('Genres'))
    await user.type(combo('Genres'), 'Roman')
    await user.click(await option('Romance'))

    // `hidePickedOptions`, so the only "Romance" left is the pill in the field.
    expect(screen.getByText('Romance')).toBeTruthy()

    // A genre nobody has agreed on is how a library ends up with three
    // spellings of the same shelf, so there is nothing to press.
    await user.clear(combo('Genres'))
    await user.type(combo('Genres'), 'Cyberpunk')
    expect(await options('Cyberpunk')).toEqual([])
  })

  it('has one shelf to put it on, for now', () => {
    renderWithProviders(<BookForm initial={emptyDraft()} onCancel={vi.fn()} />)

    expect(field('⭐ Favourites')).toBeTruthy()
  })

  it('shows the edition already chosen rather than folded away', () => {
    renderWithProviders(
      <BookForm initial={draftFromResult(aResult())} onCancel={vi.fn()} />,
    )

    expect(
      screen
        .getByRole('radio', { name: 'Paperback' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      screen
        .getByRole('radio', { name: 'Audiobook' })
        .getAttribute('aria-checked'),
    ).toBe('false')
  })

  it('changes format when another one is chosen', async () => {
    const user = userEvent.setup()

    renderWithProviders(<BookForm initial={emptyDraft()} onCancel={vi.fn()} />)

    await user.click(screen.getByRole('radio', { name: 'Audiobook' }))

    expect(
      screen
        .getByRole('radio', { name: 'Audiobook' })
        .getAttribute('aria-checked'),
    ).toBe('true')
  })

  it('cannot be saved yet, and does not pretend otherwise', () => {
    renderWithProviders(<BookForm initial={emptyDraft()} onCancel={vi.fn()} />)

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Save book' })
        .disabled,
    ).toBe(true)
  })

  it('hands the way out back to the page, which owns the router', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    renderWithProviders(<BookForm initial={emptyDraft()} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
