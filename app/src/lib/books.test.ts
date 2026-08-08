import { describe, expect, it } from 'vitest'

import {
  DEFAULT_EDITION_FORMAT,
  DEFAULT_MEDIA_TYPE,
  draftFromResult,
  emptyDraft,
} from './books'

import type { BookSearchResult } from './bookSearch'

function aResult(overrides: Partial<BookSearchResult> = {}): BookSearchResult {
  return {
    id: 'ol-devils-pawn',
    title: "The Devil's Pawn",
    subtitle: null,
    authors: ['Yvonne Whittal'],
    publishedYear: 1984,
    publisher: 'G K Hall & Co',
    coverUrl: 'https://covers.example/1.jpg',
    isbn13: '9780373107827',
    isbn10: '0263748707',
    pageCount: 188,
    language: 'en',
    description: null,
    provider: 'Open Library',
    ...overrides,
  }
}

describe('emptyDraft', () => {
  it('starts with one blank contributor, so there is a row to type into', () => {
    expect(emptyDraft().contributors).toEqual([{ name: '', role: 'Author' }])
  })

  it('picks the defaults rather than leaving the selects empty', () => {
    const draft = emptyDraft()

    expect(draft.mediaType).toBe(DEFAULT_MEDIA_TYPE)
    expect(draft.edition.format).toBe(DEFAULT_EDITION_FORMAT)
  })

  it('says "nothing yet" with empty values, never undefined', () => {
    // `useForm` reads its defaults once, so a key that arrives later arrives
    // after the field bound to it.
    const draft = emptyDraft()

    expect(Object.values(draft).some((value) => value === undefined)).toBe(
      false,
    )
    expect(
      Object.values(draft.edition).some((value) => value === undefined),
    ).toBe(false)
  })
})

describe('draftFromResult', () => {
  it('carries the edition across', () => {
    const draft = draftFromResult(aResult())

    expect(draft.title).toBe("The Devil's Pawn")
    expect(draft.edition.publisher).toBe('G K Hall & Co')
    expect(draft.edition.isbn13).toBe('9780373107827')
    expect(draft.edition.isbn10).toBe('0263748707')
    expect(draft.edition.pageCount).toBe(188)
    expect(draft.edition.language).toBe('en')
  })

  it('makes every author an Author, because a provider does not say otherwise', () => {
    const draft = draftFromResult(
      aResult({ authors: ['Fyodor Dostoevsky', 'David Magarshack'] }),
    )

    expect(draft.contributors).toEqual([
      { name: 'Fyodor Dostoevsky', role: 'Author' },
      { name: 'David Magarshack', role: 'Author' },
    ])
  })

  it('keeps a blank row when the provider names nobody', () => {
    expect(draftFromResult(aResult({ authors: [] })).contributors).toEqual([
      { name: '', role: 'Author' },
    ])
  })

  it('rounds a bare year to the first of January, since a date input needs one', () => {
    expect(draftFromResult(aResult()).edition.publishDate).toBe('1984-01-01')
  })

  it('leaves the date alone when there is no year at all', () => {
    expect(
      draftFromResult(aResult({ publishedYear: null })).edition.publishDate,
    ).toBe('')
  })

  it('turns every missing field into an empty one rather than undefined', () => {
    const draft = draftFromResult(
      aResult({
        subtitle: null,
        publisher: null,
        isbn13: null,
        isbn10: null,
        pageCount: null,
        language: null,
        description: null,
      }),
    )

    expect(draft.subtitle).toBe('')
    expect(draft.description).toBe('')
    expect(draft.edition.publisher).toBe('')
    expect(draft.edition.isbn13).toBe('')
    expect(draft.edition.isbn10).toBe('')
    expect(draft.edition.pageCount).toBe('')
    expect(draft.edition.language).toBe('')
  })

  it('leaves media type at the default - a provider does not know what it is', () => {
    expect(draftFromResult(aResult()).mediaType).toBe(DEFAULT_MEDIA_TYPE)
  })
})
