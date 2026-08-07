/**
 * What the dashboard shows, in one place.
 *
 * None of the domain endpoints exist yet, so `useDashboard` answers with an
 * empty summary and every card renders its empty state - which is what a
 * freshly claimed instance would show in any case. When `GET /dashboard`
 * lands, this file becomes a `useQuery` against it and nothing above has to
 * change: the cards already take their data as props.
 */

export interface BookSummary {
  id: string
  title: string
  authors: string[]
  coverUrl: string | null
}

export interface ReadingBook extends BookSummary {
  /** 0-100. */
  progress: number
}

export interface SeriesNextUp extends BookSummary {
  seriesName: string
  /** Position in the series, 1-based. */
  seriesIndex: number
}

/** One bar of the year chart. `month` is `YYYY-MM`. */
export interface MonthlyCount {
  month: string
  finished: number
}

export interface DashboardStats {
  reading: number
  favourites: number
  totalBooks: number
  unread: number
}

export interface DashboardSummary {
  /** Zero means the instance has no libraries yet, which is what puts the
   *  "create your first library" prompt on the page. */
  libraryCount: number
  stats: DashboardStats
  finishedThisYear: number
  /** Twelve buckets, oldest first, ending with the current month. */
  finishedByMonth: MonthlyCount[]
  currentlyReading: ReadingBook[]
  upNextInSeries: SeriesNextUp[]
  recentlyFinished: BookSummary[]
  picksOfTheDay: BookSummary[]
  recentlyAdded: BookSummary[]
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * The twelve buckets the year chart draws, oldest first and ending with the
 * month `now` falls in. Empty, for now; the API will fill in the counts.
 */
export function lastTwelveMonths(now: Date): MonthlyCount[] {
  return Array.from({ length: 12 }, (_, index) => ({
    month: monthKey(
      new Date(now.getFullYear(), now.getMonth() - 11 + index, 1),
    ),
    finished: 0,
  }))
}

/** `2026-08` -> `Aug`, in the reader's locale. */
export function monthLabel(month: string, locale?: string): string {
  const [year, index] = month.split('-').map(Number)
  return new Date(year, index - 1, 1).toLocaleDateString(locale, {
    month: 'short',
  })
}

export function emptyDashboard(now: Date): DashboardSummary {
  return {
    libraryCount: 0,
    stats: { reading: 0, favourites: 0, totalBooks: 0, unread: 0 },
    finishedThisYear: 0,
    finishedByMonth: lastTwelveMonths(now),
    currentlyReading: [],
    upNextInSeries: [],
    recentlyFinished: [],
    picksOfTheDay: [],
    recentlyAdded: [],
  }
}

/**
 * The seam. Today it is a constant; tomorrow it is a query, and the page above
 * it does not notice.
 */
export function useDashboard(now: Date): DashboardSummary {
  return emptyDashboard(now)
}
