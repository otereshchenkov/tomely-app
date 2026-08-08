import { describe, expect, it } from 'vitest'

import { bookSearchQuery, looksLikeIsbn, searchBooks } from './bookSearch'

// The stand-in pauses to make the progress bar worth drawing. Tests are not
// interested in the pause.
const now = { delayMs: 0 }

describe('looksLikeIsbn', () => {
  it('recognises both lengths, however they are punctuated', () => {
    expect(looksLikeIsbn('9780441013593')).toBe(true)
    expect(looksLikeIsbn('978-0-441-01359-3')).toBe(true)
    expect(looksLikeIsbn('0 441 01359 7')).toBe(true)
    expect(looksLikeIsbn('026378677X')).toBe(true)
  })

  it('treats anything else as words, numbers and all', () => {
    expect(looksLikeIsbn('The devils')).toBe(false)
    expect(looksLikeIsbn('1984')).toBe(false)
    expect(looksLikeIsbn('')).toBe(false)
  })
})

describe('searchBooks', () => {
  it('matches on title, whatever the case', async () => {
    const results = await searchBooks('the devil', now)

    expect(results.length).toBeGreaterThan(1)
    expect(
      results.every((result) => result.title.toLowerCase().includes('devil')),
    ).toBe(true)
  })

  it('matches words rather than substrings, so an apostrophe costs nothing', async () => {
    const titles = (await searchBooks('the devils', now)).map(
      (result) => result.title,
    )

    // Plural query, singular possessive title: the same book to anyone typing.
    expect(titles).toContain("The Devil's Pawn")
    expect(titles).toContain('The Devils')
    // Every word has to land, and "prada" is not in any of these.
    expect(await searchBooks('devils prada', now)).toEqual([
      expect.objectContaining({ title: 'The Devil Wears Prada' }),
    ])
  })

  it('is not fooled by a fragment of a word', async () => {
    expect(await searchBooks('evil', now)).toEqual([])
  })

  it('matches on author too', async () => {
    const results = await searchBooks('Dostoevsky', now)

    expect(results.map((result) => result.title)).toEqual(['The Devils'])
  })

  it('matches on ISBN once the query looks like one', async () => {
    const results = await searchBooks('978-0-441-01359-3', now)

    expect(results.map((result) => result.title)).toEqual(['Dune'])
  })

  it('finds nothing for a query nothing matches', async () => {
    expect(await searchBooks('sdafdf', now)).toEqual([])
  })

  it('finds nothing for a blank query rather than everything', async () => {
    expect(await searchBooks('   ', now)).toEqual([])
  })

  it('gives up when the caller does', async () => {
    const controller = new AbortController()
    const pending = searchBooks('devil', { signal: controller.signal })

    controller.abort()

    await expect(pending).rejects.toBeTruthy()
  })
})

describe('bookSearchQuery', () => {
  it('keys on the trimmed query, so the same search is the same cache entry', () => {
    expect(bookSearchQuery('  devil ').queryKey).toEqual([
      'book-search',
      'devil',
    ])
  })

  it('does not run until there is something to search for', () => {
    expect(bookSearchQuery('').enabled).toBe(false)
    expect(bookSearchQuery('devil').enabled).toBe(true)
  })
})
