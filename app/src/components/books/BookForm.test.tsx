import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '#/test/render'
import { draftFromResult, emptyDraft } from '#/lib/books'

import { BookForm } from './BookForm'

import type { BookSearchResult } from '#/lib/bookSearch'
import type { Genre, MediaType } from '#/lib/catalogue'

// The two catalogues, as the page above would have fetched them. Small enough to
// be readable and varied enough that picking the wrong one shows.
const MEDIA_TYPES: Array<MediaType> = [
  {
    id: 'mt-novel',
    name: 'Novel',
    description: 'Full-length fiction or non-fiction book',
    bookCount: 0,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'mt-manga',
    name: 'Manga',
    description: 'Japanese comic book / graphic novel',
    bookCount: 0,
    createdAt: '',
    updatedAt: '',
  },
  // One without a description, since the column is optional.
  {
    id: 'mt-zine',
    name: 'Zine',
    description: null,
    bookCount: 0,
    createdAt: '',
    updatedAt: '',
  },
]

const GENRES: Array<Genre> = [
  {
    id: 'g-romance',
    name: 'Romance',
    bookCount: 0,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'g-horror',
    name: 'Horror',
    bookCount: 0,
    createdAt: '',
    updatedAt: '',
  },
]

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
// A media type option's accessible name is its name *and* its description run
// together, so these take a matcher rather than a string.
const option = (name: string | RegExp) =>
  screen.findByRole('option', { name, hidden: true })

const options = (name: string | RegExp) =>
  screen.findAllByRole('option', { name, hidden: true }).catch(() => [])

describe('BookForm', () => {
  it('arrives blank when nothing was picked', () => {
    renderWithProviders(
      <BookForm
        initial={emptyDraft()}
        mediaTypes={MEDIA_TYPES}
        genres={GENRES}
        onCancel={vi.fn()}
      />,
    )

    expect(field(/^Title/).value).toBe('')
    // Empty, not "Novel": a media type is a row now, and the instance has no
    // notion of a default one, so the field asks rather than guessing.
    expect(combo('Media type').value).toBe('')
    expect(field('Contributor 1 name').value).toBe('')
  })

  it('offers the media types the instance has, and shows the one picked', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <BookForm
        initial={emptyDraft()}
        mediaTypes={MEDIA_TYPES}
        genres={GENRES}
        onCancel={vi.fn()}
      />,
    )

    await user.click(combo('Media type'))
    await user.click(await option(/^Manga/))

    // The draft holds the id; the field shows the name, which is the whole point
    // of the options being built from rows rather than from strings.
    expect(combo('Media type').value).toBe('Manga')
  })

  it('says what each media type means, since the names alone do not', async () => {
    // "Manga", "Manhwa" and "Manhua" are not words most readers can tell apart,
    // and the settings page has already asked somebody to write down the
    // difference - so the list that matters shows it.
    const user = userEvent.setup()

    renderWithProviders(
      <BookForm
        initial={emptyDraft()}
        mediaTypes={MEDIA_TYPES}
        genres={GENRES}
        onCancel={vi.fn()}
      />,
    )

    await user.click(combo('Media type'))

    expect(
      await option('Manga Japanese comic book / graphic novel'),
    ).toBeTruthy()
    expect(
      await option('Novel Full-length fiction or non-fiction book'),
    ).toBeTruthy()
    // The column is optional, so one without a description is just its name.
    expect(await option('Zine')).toBeTruthy()
  })

  it('arrives filled in from a picked result', () => {
    renderWithProviders(
      <BookForm
        initial={draftFromResult(aResult())}
        mediaTypes={MEDIA_TYPES}
        genres={GENRES}
        onCancel={vi.fn()}
      />,
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
        mediaTypes={MEDIA_TYPES}
        genres={GENRES}
        onCancel={vi.fn()}
      />,
    )

    expect(field('Contributor 1 name').value).toBe('Fyodor Dostoevsky')
    expect(field('Contributor 2 name').value).toBe('David Magarshack')
  })

  it('adds and removes contributor rows', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <BookForm
        initial={emptyDraft()}
        mediaTypes={MEDIA_TYPES}
        genres={GENRES}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(field('Contributor 2 name')).toBeTruthy()

    await user.click(
      screen.getByRole('button', { name: 'Remove contributor 2' }),
    )
    expect(screen.queryByLabelText('Contributor 2 name')).toBeNull()
  })

  it('lets a tag be invented on the spot', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <BookForm
        initial={emptyDraft()}
        mediaTypes={MEDIA_TYPES}
        genres={GENRES}
        onCancel={vi.fn()}
      />,
    )

    await user.type(combo('Tags'), 'to reread{Enter}')

    expect(screen.getByText('to reread')).toBeTruthy()
  })

  it('offers genres from the instance catalogue, and takes nothing else', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <BookForm
        initial={emptyDraft()}
        mediaTypes={MEDIA_TYPES}
        genres={GENRES}
        onCancel={vi.fn()}
      />,
    )

    await user.click(combo('Genres'))
    await user.type(combo('Genres'), 'Roman')
    await user.click(await option('Romance'))

    // `hidePickedOptions`, so the only "Romance" left is the pill in the field.
    expect(screen.getByText('Romance')).toBeTruthy()

    // A genre nobody has agreed on is how a library ends up with three
    // spellings of the same shelf, so there is nothing to press - inventing one
    // is a job for the settings page, not for the book form.
    await user.clear(combo('Genres'))
    await user.type(combo('Genres'), 'Cyberpunk')
    expect(await options('Cyberpunk')).toEqual([])
  })

  it('has one shelf to put it on, for now', () => {
    renderWithProviders(
      <BookForm
        initial={emptyDraft()}
        mediaTypes={MEDIA_TYPES}
        genres={GENRES}
        onCancel={vi.fn()}
      />,
    )

    expect(field('⭐ Favourites')).toBeTruthy()
  })

  it('shows the edition already chosen rather than folded away', () => {
    renderWithProviders(
      <BookForm
        initial={draftFromResult(aResult())}
        mediaTypes={MEDIA_TYPES}
        genres={GENRES}
        onCancel={vi.fn()}
      />,
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

    renderWithProviders(
      <BookForm
        initial={emptyDraft()}
        mediaTypes={MEDIA_TYPES}
        genres={GENRES}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('radio', { name: 'Audiobook' }))

    expect(
      screen
        .getByRole('radio', { name: 'Audiobook' })
        .getAttribute('aria-checked'),
    ).toBe('true')
  })

  it('cannot be saved yet, and does not pretend otherwise', () => {
    renderWithProviders(
      <BookForm
        initial={emptyDraft()}
        mediaTypes={MEDIA_TYPES}
        genres={GENRES}
        onCancel={vi.fn()}
      />,
    )

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Save book' })
        .disabled,
    ).toBe(true)
  })

  it('hands the way out back to the page, which owns the router', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    renderWithProviders(
      <BookForm
        initial={emptyDraft()}
        mediaTypes={MEDIA_TYPES}
        genres={GENRES}
        onCancel={onCancel}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
