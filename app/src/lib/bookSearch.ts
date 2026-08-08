/**
 * Looking a book up before adding it, in one place.
 *
 * There is no search endpoint yet - there is no books endpoint at all - so this
 * answers out of a fixed catalogue after a pause, the way `dashboard.ts` answers
 * with an empty summary. It is the seam: when `GET /book-search?q=` lands,
 * `searchBooks` becomes an `apiFetch` and nothing above it has to change,
 * because the panel and the two routes only ever see `BookSearchResult`.
 *
 * Deterministic on purpose. The same query always gives the same answer, which
 * is what lets the form step re-run a search to recover the book it was handed
 * when someone reloads it or pastes the link somewhere else.
 */
import { queryOptions } from '@tanstack/react-query'

/**
 * One hit from a metadata provider - not a book in the library. Nothing here
 * has been saved; it is a suggestion to fill the form in with.
 */
export interface BookSearchResult {
  /** The provider's id for this edition, not ours. */
  id: string
  title: string
  subtitle: string | null
  authors: string[]
  publishedYear: number | null
  publisher: string | null
  coverUrl: string | null
  isbn13: string | null
  isbn10: string | null
  pageCount: number | null
  /** An ISO 639-1 code, matching the `LANGUAGES` options in `books.ts`. */
  language: string | null
  description: string | null
  /** Which provider it came from, shown under each hit. One, for now. */
  provider: string
}

const OPEN_LIBRARY = 'Open Library'

/** `978…` -> the cover Open Library serves for it, if it has one. */
function cover(isbn13: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn13}-M.jpg`
}

/**
 * The stand-in for a provider.
 *
 * Enough of it to exercise every state the panel can be in: a query with many
 * hits, a query with one, and a query with none. Searching "devil" is the tour.
 */
const CATALOGUE: BookSearchResult[] = [
  {
    id: 'ol-devils-pawn',
    title: "The Devil's Pawn",
    subtitle: null,
    authors: ['Yvonne Whittal'],
    publishedYear: 1984,
    publisher: 'G K Hall & Co',
    coverUrl: cover('9780373107827'),
    isbn13: '9780373107827',
    isbn10: '0263748707',
    pageCount: 188,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-sup-with-the-devil',
    title: 'Sup with the Devil',
    subtitle: null,
    authors: ['Sara Craven'],
    publishedYear: 1983,
    publisher: 'Mills & Boon',
    coverUrl: cover('9780263743074'),
    isbn13: '9780263743074',
    isbn10: '0263743071',
    pageCount: 188,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-devils-price',
    title: "The Devil's Price",
    subtitle: null,
    authors: ['Carole Mortimer'],
    publishedYear: 1985,
    publisher: 'Harlequin',
    coverUrl: cover('9780373107896'),
    isbn13: '9780373107896',
    isbn10: '0373107897',
    pageCount: 192,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-when-the-devil-drives',
    title: 'When The Devil Drives',
    subtitle: null,
    authors: ['Sara Craven'],
    publishedYear: 1991,
    publisher: 'Mills & Boon',
    coverUrl: cover('9780263773422'),
    isbn13: '9780263773422',
    isbn10: '0263773426',
    pageCount: 190,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-outwitting-the-devil',
    title: 'Outwitting the devil',
    subtitle: 'The secret to freedom and success',
    authors: ['Napoleon Hill'],
    publishedYear: 2011,
    publisher: 'Sterling',
    coverUrl: cover('9781454900672'),
    isbn13: '9781454900672',
    isbn10: '1454900679',
    pageCount: 291,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-devils-bride',
    title: "The Devil's Bride",
    subtitle: null,
    authors: ['Margaret Pargeter'],
    publishedYear: 1979,
    publisher: 'Mills & Boon',
    coverUrl: cover('9780263731095'),
    isbn13: '9780263731095',
    isbn10: '0263731090',
    pageCount: 188,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-devils-shadow',
    title: "The devil's shadow",
    subtitle: null,
    authors: ['Sally Wentworth'],
    publishedYear: 1989,
    publisher: 'Mills & Boon',
    coverUrl: cover('9780263764789'),
    isbn13: '9780263764789',
    isbn10: '0263764788',
    pageCount: 187,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-devil-in-the-white-city',
    title: 'The Devil in the White City',
    subtitle: 'Murder, magic, and madness at the fair that changed America',
    authors: ['Erik Larson'],
    publishedYear: 2003,
    publisher: 'Vintage Books',
    coverUrl: cover('9780375725609'),
    isbn13: '9780375725609',
    isbn10: '0375725601',
    pageCount: 447,
    language: 'en',
    description:
      'The true story of the architect who built the 1893 World’s Fair and the serial killer who worked in its shadow.',
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-saving-the-devil',
    title: 'Saving the Devil',
    subtitle: null,
    authors: ['Sophie Weston'],
    publishedYear: 1994,
    publisher: 'Mills & Boon',
    coverUrl: cover('9780263786774'),
    isbn13: '9780263786774',
    isbn10: '026378677X',
    pageCount: 186,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-devil-wears-prada',
    title: 'The Devil Wears Prada',
    subtitle: null,
    authors: ['Lauren Weisberger'],
    publishedYear: 2003,
    publisher: 'Broadway Books',
    coverUrl: cover('9780767914765'),
    isbn13: '9780767914765',
    isbn10: '0767914767',
    pageCount: 360,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-the-devils',
    title: 'The Devils',
    subtitle: null,
    authors: ['Fyodor Dostoevsky', 'David Magarshack'],
    publishedYear: 1971,
    publisher: 'Penguin Classics',
    coverUrl: cover('9780140449143'),
    isbn13: '9780140449143',
    isbn10: '0140449140',
    pageCount: 704,
    language: 'en',
    description:
      'A provincial town is torn apart by a circle of revolutionaries in Dostoevsky’s bleakest novel.',
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-devil-may-care',
    title: 'Devil May Care',
    subtitle: 'A James Bond novel',
    authors: ['Sebastian Faulks', 'Ian Fleming'],
    publishedYear: 2008,
    publisher: 'Doubleday',
    coverUrl: cover('9780385524285'),
    isbn13: '9780385524285',
    isbn10: '0385524285',
    pageCount: 295,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-devils-advocate',
    title: "The Devil's Advocate",
    subtitle: null,
    authors: ['Morris West'],
    publishedYear: 1959,
    publisher: 'William Morrow',
    coverUrl: cover('9780749313708'),
    isbn13: '9780749313708',
    isbn10: '0749313706',
    pageCount: 320,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-devil-in-a-blue-dress',
    title: 'Devil in a Blue Dress',
    subtitle: null,
    authors: ['Walter Mosley'],
    publishedYear: 1990,
    publisher: 'W. W. Norton',
    coverUrl: cover('9780671725143'),
    isbn13: '9780671725143',
    isbn10: '0671725149',
    pageCount: 219,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-devils-arithmetic',
    title: "The Devil's Arithmetic",
    subtitle: null,
    authors: ['Jane Yolen'],
    publishedYear: 1988,
    publisher: 'Puffin Books',
    coverUrl: cover('9780140345353'),
    isbn13: '9780140345353',
    isbn10: '0140345353',
    pageCount: 170,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-dune',
    title: 'Dune',
    subtitle: null,
    authors: ['Frank Herbert'],
    publishedYear: 1965,
    publisher: 'Ace Books',
    coverUrl: cover('9780441013593'),
    isbn13: '9780441013593',
    isbn10: '0441013597',
    pageCount: 688,
    language: 'en',
    description:
      'Paul Atreides comes to Arrakis, the only source of the spice that makes interstellar travel possible.',
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-the-hobbit',
    title: 'The Hobbit',
    subtitle: 'Or there and back again',
    authors: ['J. R. R. Tolkien'],
    publishedYear: 1937,
    publisher: 'George Allen & Unwin',
    coverUrl: cover('9780345339683'),
    isbn13: '9780345339683',
    isbn10: '0345339681',
    pageCount: 304,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
  {
    id: 'ol-neuromancer',
    title: 'Neuromancer',
    subtitle: null,
    authors: ['William Gibson'],
    publishedYear: 1984,
    publisher: 'Ace Books',
    coverUrl: cover('9780441569595'),
    isbn13: '9780441569595',
    isbn10: '0441569595',
    pageCount: 271,
    language: 'en',
    description: null,
    provider: OPEN_LIBRARY,
  },
]

/** How long the stand-in pretends to be talking to a provider. */
export const SEARCH_DELAY_MS = 700

/** Everything an ISBN may be written with, gone. */
function digitsOnly(value: string): string {
  return value.replace(/[\s-]/g, '')
}

/**
 * Whether a query is somebody typing an ISBN rather than a title.
 *
 * One field takes both, so this is what decides which column to match on. Ten
 * or thirteen characters, digits with an optional trailing X - anything else is
 * words, even if it happens to contain numbers.
 */
export function looksLikeIsbn(query: string): boolean {
  const bare = digitsOnly(query)
  return /^\d{9}[\dX]$/i.test(bare) || /^\d{13}$/.test(bare)
}

/** Lower-cased words, with the punctuation that separated them thrown away. */
function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

/** A plural and its singular are the same search to anybody typing one. */
function stem(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word
}

/**
 * Whether a result answers a query, roughly the way a real provider would.
 *
 * Every word of the query has to land somewhere, and a word matches a word
 * rather than a substring of the whole string. That is what lets "the devils"
 * find "The Devil's Pawn" - a plain `includes` loses it to the apostrophe -
 * while "evil" goes on finding nothing, which is the point of not matching
 * substrings.
 */
function matchesWords(result: BookSearchResult, query: string): boolean {
  const haystack = words(
    [result.title, result.subtitle ?? '', ...result.authors].join(' '),
  ).map(stem)

  return words(query)
    .map(stem)
    .every((needle) => haystack.some((word) => word.startsWith(needle)))
}

function matches(result: BookSearchResult, query: string): boolean {
  if (looksLikeIsbn(query)) {
    const bare = digitsOnly(query).toUpperCase()
    return result.isbn13 === bare || result.isbn10?.toUpperCase() === bare
  }

  return matchesWords(result, query)
}

/**
 * Ask the providers about a book.
 *
 * `delayMs` exists so tests do not sit through the pause that makes the
 * progress bar worth drawing; nothing in the app passes it.
 */
export function searchBooks(
  query: string,
  {
    signal,
    delayMs = SEARCH_DELAY_MS,
  }: { signal?: AbortSignal; delayMs?: number } = {},
): Promise<BookSearchResult[]> {
  const trimmed = query.trim()

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error)
      return
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve(
        trimmed ? CATALOGUE.filter((result) => matches(result, trimmed)) : [],
      )
    }, delayMs)

    function abort() {
      clearTimeout(timer)
      reject(signal?.reason as Error)
    }

    signal?.addEventListener('abort', abort, { once: true })
  })
}

export const bookSearchQueryKey = (query: string) => ['book-search', query]

/**
 * Results survive leaving the page and coming back, which is the whole reason
 * the form step can offer a way back to them: `staleTime: Infinity` means
 * returning to a search redraws it rather than running it again, and the long
 * `gcTime` keeps it around while the reader fills the form in.
 *
 * Once this is a real request those numbers should come down - a provider's
 * answer does go stale - but the cache is doing real work here either way.
 */
export function bookSearchQuery(query: string) {
  const trimmed = query.trim()

  return queryOptions({
    queryKey: bookSearchQueryKey(trimmed),
    queryFn: ({ signal }) => searchBooks(trimmed, { signal }),
    enabled: trimmed.length > 0,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  })
}
