/**
 * The vocabulary a book is described with, and the shape of one being written.
 *
 * Every list below is a stand-in. Media types, contributor roles, genres,
 * languages and shelves are all things an instance will eventually own rows
 * for - genres and shelves certainly, since the point of a private library is
 * that it is arranged the way its owner wants. Until those endpoints exist they
 * are constants here, in one file, so replacing them is a change to this module
 * and not a search through the form.
 *
 * Tags are the exception and always will be: they are free text the reader
 * invents while typing, so there is no list to fetch.
 */
import type { BookSearchResult } from './bookSearch'

/** What kind of thing it is, rather than what it is printed on. */
export const MEDIA_TYPES = [
  'Novel',
  'Novella',
  'Short stories',
  'Non-fiction',
  'Manga',
  'Comic',
  'Graphic novel',
  'Light novel',
  'Poetry',
  'Anthology',
  'Reference',
  'Textbook',
] as const

export const DEFAULT_MEDIA_TYPE = 'Novel'

/** How a person is attached to a book. */
export const CONTRIBUTOR_ROLES = [
  'Author',
  'Co-author',
  'Illustrator',
  'Translator',
  'Editor',
  'Narrator',
  'Foreword',
] as const

export type ContributorRole = (typeof CONTRIBUTOR_ROLES)[number]

export const DEFAULT_CONTRIBUTOR_ROLE: ContributorRole = 'Author'

/**
 * What the copy on the shelf physically is. Icons live with the form - this
 * file has no opinion about how a format is drawn.
 */
export const EDITION_FORMATS = [
  'Paperback',
  'Hardcover',
  'E-Book',
  'Audiobook',
] as const

export type EditionFormat = (typeof EDITION_FORMATS)[number]

export const DEFAULT_EDITION_FORMAT: EditionFormat = 'Paperback'

/**
 * A fixed set, unlike tags: a genre is a shared word, and letting every book
 * invent one is how a library ends up with "sci-fi", "Sci Fi" and "SF".
 */
export const GENRES = [
  'Adventure',
  'Biography',
  'Children',
  'Classics',
  'Contemporary',
  'Crime',
  'Dystopian',
  'Essays',
  'Fantasy',
  'Historical',
  'History',
  'Horror',
  'Humour',
  'Literary fiction',
  'Memoir',
  'Mystery',
  'Philosophy',
  'Poetry',
  'Politics',
  'Popular science',
  'Psychology',
  'Romance',
  'Science fiction',
  'Self-help',
  'Short stories',
  'Thriller',
  'Travel',
  'True crime',
  'Young adult',
] as const

/** ISO 639-1, because that is what a provider answers with. */
export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
] as const

/**
 * The shelves a book can be put on as it is added.
 *
 * One, for now, and it is the one the dashboard already counts. Real shelves
 * belong to a library and arrive with `GET /libraries/{id}/shelves`.
 */
export const SHELVES = [
  { value: 'favourites', label: '⭐ Favourites' },
] as const

export interface Contributor {
  name: string
  role: ContributorRole
}

/** The copy being catalogued, as opposed to the work. */
export interface EditionDraft {
  format: EditionFormat
  name: string
  publisher: string
  /** `YYYY-MM-DD`, which is what `<input type="date">` reads and writes. */
  publishDate: string
  /** An ISO 639-1 code, or '' for "not said". */
  language: string
  isbn13: string
  isbn10: string
  /** `NumberInput` hands back `''` when it is empty, so this is not `number`. */
  pageCount: string | number
}

/**
 * A book being written, before anything has been saved.
 *
 * Every field is present and none is optional: `useForm` reads `defaultValues`
 * once, and a key that appears later would arrive after the field bound to it.
 * "Nothing here yet" is `''`, `[]` or the default - never `undefined`.
 */
export interface BookDraft {
  title: string
  subtitle: string
  mediaType: string
  description: string
  contributors: Contributor[]
  tags: string[]
  genres: string[]
  shelves: string[]
  edition: EditionDraft
}

export function emptyDraft(): BookDraft {
  return {
    title: '',
    subtitle: '',
    mediaType: DEFAULT_MEDIA_TYPE,
    description: '',
    contributors: [{ name: '', role: DEFAULT_CONTRIBUTOR_ROLE }],
    tags: [],
    genres: [],
    shelves: [],
    edition: {
      format: DEFAULT_EDITION_FORMAT,
      name: '',
      publisher: '',
      publishDate: '',
      language: '',
      isbn13: '',
      isbn10: '',
      pageCount: '',
    },
  }
}

/**
 * Turn a provider's answer into a form to correct.
 *
 * The whole prefill rule, in one pure function, so what a picked search result
 * does to the form is a thing that can be read and tested rather than something
 * scattered across the fields.
 *
 * Two judgement calls worth naming. Every author becomes an `Author` row, since
 * a provider does not say who illustrated or translated it and guessing would
 * put a wrong word in front of somebody's name. And a bare year becomes the
 * first of January: `<input type="date">` has nowhere to put "1984 sometime",
 * and a visibly rounded date the reader can fix beats an empty field that
 * quietly loses what the provider knew.
 */
export function draftFromResult(result: BookSearchResult): BookDraft {
  const empty = emptyDraft()

  return {
    ...empty,
    title: result.title,
    subtitle: result.subtitle ?? '',
    description: result.description ?? '',
    contributors:
      result.authors.length > 0
        ? result.authors.map((name) => ({
            name,
            role: DEFAULT_CONTRIBUTOR_ROLE,
          }))
        : empty.contributors,
    edition: {
      ...empty.edition,
      publisher: result.publisher ?? '',
      publishDate:
        result.publishedYear === null ? '' : `${result.publishedYear}-01-01`,
      language: result.language ?? '',
      isbn13: result.isbn13 ?? '',
      isbn10: result.isbn10 ?? '',
      pageCount: result.pageCount ?? '',
    },
  }
}
