import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '#/test/render'

import { BookSearchPanel } from './BookSearchPanel'

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

function panel(props: Partial<Parameters<typeof BookSearchPanel>[0]> = {}) {
  return (
    <BookSearchPanel
      query=""
      results={[]}
      isSearching={false}
      hasSearched={false}
      onSearch={vi.fn()}
      onPick={vi.fn()}
      onAddManually={vi.fn()}
      {...props}
    />
  )
}

const searchButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Search' })

describe('BookSearchPanel', () => {
  it('will not search for nothing', () => {
    renderWithProviders(panel())

    expect(searchButton().disabled).toBe(true)
  })

  it('hands the trimmed query up to the page, which puts it in the URL', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()

    renderWithProviders(panel({ onSearch }))

    await user.type(screen.getByLabelText('Search for a book'), '  The devils ')
    await user.click(searchButton())

    expect(onSearch).toHaveBeenCalledWith('The devils')
  })

  it('arrives filled in when the URL already holds a search', () => {
    renderWithProviders(panel({ query: 'Dune', hasSearched: true }))

    expect(
      screen.getByLabelText<HTMLInputElement>('Search for a book').value,
    ).toBe('Dune')
  })

  it('says it is working while it works', () => {
    renderWithProviders(
      panel({ query: 'devil', hasSearched: true, isSearching: true }),
    )

    expect(screen.getByText('Searching providers…')).toBeTruthy()
    // No answer yet, so nothing that reads as one.
    expect(screen.queryByText('No results found.')).toBeNull()
  })

  it('says so, in red, when nothing matched', () => {
    renderWithProviders(panel({ query: 'sdafdf', hasSearched: true }))

    expect(screen.getByText('No results found.')).toBeTruthy()
  })

  it('stays quiet before anything has been searched for', () => {
    renderWithProviders(panel())

    expect(screen.queryByText('No results found.')).toBeNull()
    expect(screen.queryByText('Searching providers…')).toBeNull()
  })

  it('counts the results and describes each one', () => {
    renderWithProviders(
      panel({
        query: 'devil',
        hasSearched: true,
        results: [
          aResult(),
          aResult({
            id: 'ol-dune',
            title: 'Dune',
            authors: ['Frank Herbert'],
            publishedYear: 1965,
          }),
        ],
      }),
    )

    expect(screen.getByText('2 results')).toBeTruthy()
    expect(screen.getByText("The Devil's Pawn")).toBeTruthy()
    expect(screen.getByText('Yvonne Whittal')).toBeTruthy()
    expect(screen.getByText('1984 · Open Library')).toBeTruthy()
    expect(screen.getByText('Dune')).toBeTruthy()
    expect(screen.getByText('1965 · Open Library')).toBeTruthy()
  })

  it('says "1 result" when there is one', () => {
    renderWithProviders(
      panel({ query: 'dune', hasSearched: true, results: [aResult()] }),
    )

    expect(screen.getByText('1 result')).toBeTruthy()
  })

  it('hands the whole result up when one is chosen', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const wanted = aResult({
      id: 'ol-dune',
      title: 'Dune',
      authors: ['Frank Herbert'],
    })

    renderWithProviders(
      panel({
        query: 'devil',
        hasSearched: true,
        results: [aResult(), wanted],
        onPick,
      }),
    )

    await user.click(screen.getByText('Dune'))

    expect(onPick).toHaveBeenCalledWith(wanted)
  })

  it('offers a way past search entirely', async () => {
    const user = userEvent.setup()
    const onAddManually = vi.fn()

    renderWithProviders(panel({ onAddManually }))

    await user.click(
      screen.getByRole('button', { name: 'Add manually instead →' }),
    )

    expect(onAddManually).toHaveBeenCalledTimes(1)
  })
})
