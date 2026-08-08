import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, Stack } from '@mantine/core'
import { z } from 'zod'

import { AppLayout } from '#/components/layout/AppLayout'
import { RequireAuth } from '#/components/RequireAuth'
import { BookSearchPanel } from '#/components/books/BookSearchPanel'
import { LibraryBreadcrumbs } from '#/components/libraries/LibraryBreadcrumbs'
import { bookSearchQuery } from '#/lib/bookSearch'
import { useLibrary } from '#/lib/libraries'

import type { BookSearchResult } from '#/lib/bookSearch'

// The search lives in the URL, so the back button out of the form step lands on
// the results rather than on an empty box, and a search can be linked to.
// `.catch()` because a hand-edited `?q` should degrade to "no search yet".
const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/libraries/$libraryId/books/add')({
  validateSearch: searchSchema,
  component: AddBook,
})

/**
 * Step one of adding a book: find it somewhere else first.
 *
 * No `loader`: nothing here is prefetchable. The search needs no token but the
 * library name in the breadcrumbs does, so the page follows the same shape as
 * every other private one - shell on the server, contents once the client knows
 * who is asking.
 */
function AddBook() {
  const { libraryId } = Route.useParams()
  const { data: library } = useLibrary(libraryId)

  return (
    <AppLayout
      breadcrumbs={<LibraryBreadcrumbs library={library} current="Add book" />}
      title="Add book"
      subtitle="Search for it, or add it by hand"
    >
      <RequireAuth>
        <AddBookContent />
      </RequireAuth>
    </AppLayout>
  )
}

function AddBookContent() {
  const { libraryId } = Route.useParams()
  const { q } = Route.useSearch()
  const navigate = useNavigate()

  const query = q ?? ''
  const { data, isPending, isFetching } = useQuery(bookSearchQuery(query))

  // `isPending` covers the render between navigating to a new `?q=` and the
  // request actually starting, which is otherwise a frame of "No results
  // found." on a search that has not run yet.
  const isSearching = query !== '' && (isPending || isFetching)

  const goToForm = (result: BookSearchResult | null) => {
    void navigate({
      to: '/libraries/$libraryId/books/new',
      params: { libraryId },
      search: result ? { q: query, from: result.id } : {},
    })
  }

  return (
    <Stack maw={720}>
      <Card withBorder radius="md" padding="lg">
        <BookSearchPanel
          query={query}
          results={data ?? []}
          isSearching={isSearching}
          hasSearched={query !== ''}
          onSearch={(next) => {
            void navigate({
              to: '/libraries/$libraryId/books/add',
              params: { libraryId },
              search: { q: next },
            })
          }}
          onPick={goToForm}
          onAddManually={() => goToForm(null)}
        />
      </Card>
    </Stack>
  )
}
