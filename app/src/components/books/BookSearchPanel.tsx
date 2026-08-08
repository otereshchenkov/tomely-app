import { useState } from 'react'
import {
  Anchor,
  Button,
  Group,
  Progress,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'

import { BookCover } from '#/components/dashboard/BookRow'

import classes from './BookSearchPanel.module.css'

import type { BookSearchResult } from '#/lib/bookSearch'

/**
 * The first step of adding a book: ask the providers about it.
 *
 * One field takes a title, an author or an ISBN, rather than a tab strip that
 * makes the reader classify what they are holding before they can type it -
 * `looksLikeIsbn` in `lib/bookSearch.ts` works that out instead. The way past
 * search entirely is the link underneath, so nothing here is a dead end.
 *
 * Presentational and router-free on purpose, the same contract `BooksToolbar`
 * and `NewLibraryModal` keep: the query lives in the URL, and the route above
 * owns it. That is what lets someone come back to their results after picking
 * the wrong book.
 */
export function BookSearchPanel({
  query,
  results,
  isSearching,
  hasSearched,
  onSearch,
  onPick,
  onAddManually,
}: Readonly<{
  /** The search the page is showing - from the URL, not from the input. */
  query: string
  results: BookSearchResult[]
  isSearching: boolean
  /** Whether there is a search to report on at all. Without it an untouched
   *  page and a search that found nothing look identical. */
  hasSearched: boolean
  onSearch: (query: string) => void
  onPick: (result: BookSearchResult) => void
  onAddManually: () => void
}>) {
  // The field holds what is being typed, not what is in the URL - typing must
  // not push history - but arriving at a search should still fill it in. So it
  // is seeded from `query` and re-seeded whenever `query` itself changes, which
  // is what makes the back button out of the form step land on the search that
  // was run rather than on an empty box. Adjusting state during render is the
  // supported way to do this; a key would work too, at the cost of the focus.
  const [draft, setDraft] = useState(query)
  const [seeded, setSeeded] = useState(query)

  if (seeded !== query) {
    setSeeded(query)
    setDraft(query)
  }

  const canSearch = draft.trim().length > 0 && !isSearching

  return (
    <Stack gap="md">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (canSearch) onSearch(draft.trim())
        }}
      >
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <TextInput
            aria-label="Search for a book"
            placeholder="Search by title, author, or ISBN..."
            data-autofocus
            flex={1}
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
          />
          <Button type="submit" disabled={!canSearch} loading={isSearching}>
            Search
          </Button>
        </Group>
      </form>

      {isSearching ? (
        <Stack gap={6} role="status">
          <Progress value={100} animated size="sm" />
          <Text fz="sm" c="dimmed">
            Searching providers...
          </Text>
        </Stack>
      ) : null}

      {/* A `button` so the route decides where it goes, which means it is a
          block that would otherwise stretch across the stack and centre its
          own text. */}
      <Anchor
        component="button"
        type="button"
        fz="sm"
        style={{ alignSelf: 'flex-start' }}
        onClick={onAddManually}
      >
        Add manually instead →
      </Anchor>

      {hasSearched && !isSearching ? (
        <Results results={results} onPick={onPick} />
      ) : null}
    </Stack>
  )
}

function Results({
  results,
  onPick,
}: Readonly<{
  results: BookSearchResult[]
  onPick: (result: BookSearchResult) => void
}>) {
  if (results.length === 0) {
    // Red, because this is the answer to what was asked and not an aside. There
    // is still the manual link above it, so it is a dead end only for search.
    return (
      <Text fz="sm" c="red">
        No results found.
      </Text>
    )
  }

  return (
    <Stack gap="xs">
      <Text
        fz="xs"
        fw={600}
        c="dimmed"
        tt="uppercase"
        className={classes.count}
      >
        {results.length} {results.length === 1 ? 'result' : 'results'}
      </Text>

      {results.map((result) => (
        <UnstyledButton
          key={result.id}
          className={classes.result}
          onClick={() => onPick(result)}
        >
          <Group gap="sm" wrap="nowrap" align="flex-start">
            {/* A result already has everything `BookSummary` wants. */}
            <BookCover book={result} />
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text fz="sm" fw={600} lineClamp={2}>
                {result.title}
              </Text>
              {result.authors.length > 0 ? (
                <Text fz="sm" lineClamp={1}>
                  {result.authors.join(', ')}
                </Text>
              ) : null}
              <Text fz="xs" c="dimmed">
                {result.publishedYear === null
                  ? result.provider
                  : `${result.publishedYear} · ${result.provider}`}
              </Text>
            </Stack>
          </Group>
        </UnstyledButton>
      ))}
    </Stack>
  )
}
