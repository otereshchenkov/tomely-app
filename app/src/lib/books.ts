/**
 * The vocabulary a book is described with, and the shape of one being written.
 *
 * Media types and genres used to be constants here and are now rows - see
 * `catalogue.ts` and the `/admin/settings` pages that edit them. What is left
 * below is still a stand-in: contributor roles, edition formats, languages and
 * shelves are all things an instance will eventually own rows for - shelves
 * certainly, since the point of a private library is that it is arranged the way
 * its owner wants. Until those endpoints exist they are constants here, in one
 * file, so replacing them is a change to this module and not a search through
 * the form.
 *
 * Tags are now rows too - `tags.ts`, and the Tags tab of a library's settings -
 * but they are not vocabulary in the way the two catalogues are. A genre is a
 * word an instance has agreed on and the form offers those and nothing else; a
 * library's tags are offered as *suggestions*, and a reader who wants a word
 * nobody has used yet types it. That is why `BookDraft.tags` holds names where
 * `BookDraft.genres` holds ids: a genre is a row the draft points at, a tag may
 * still be a word waiting for one. The books endpoint is what will resolve them.
 */
import type { BookSearchResult } from './bookSearch'

/** How a person is attached to a book. */
export const CONTRIBUTOR_ROLES = [
  'Author',
  'Co-author',
  'Artist',
  'Illustrator',
  'Writer',
  'Penciller',
  'Inker',
  'Colorist',
  'Letterer',
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
  /** A `media_types` row id, or '' for "not chosen yet". */
  mediaType: string
  description: string
  contributors: Contributor[]
  /** Tag *names*, not ids - one may not have a row yet. See the module note. */
  tags: string[]
  /** `genres` row ids. */
  genres: string[]
  shelves: string[]
  edition: EditionDraft
}

/**
 * A blank book.
 *
 * `mediaType` starts empty rather than at some default. It used to be 'Novel',
 * back when the list was a constant here and 'Novel' was a value this file could
 * name; now it is a row whose id nobody knows until the catalogue has been
 * fetched, and there is no server-side notion of a default one. The field is
 * required, so the form asks rather than guessing.
 */
export function emptyDraft(): BookDraft {
  return {
    title: '',
    subtitle: '',
    mediaType: '',
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
