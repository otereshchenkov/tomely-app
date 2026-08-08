import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Alert, Anchor, Card, Center, Loader, Stack, Text } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { z } from 'zod'

import { AppLayout } from '#/components/layout/AppLayout'
import { RequireAuth } from '#/components/RequireAuth'
import { BookForm } from '#/components/books/BookForm'
import { LibraryBreadcrumbs } from '#/components/libraries/LibraryBreadcrumbs'
import { bookSearchQuery } from '#/lib/bookSearch'
import { draftFromResult, emptyDraft } from '#/lib/books'
import { useGenres, useMediaTypes } from '#/lib/catalogue'
import { useLibrary } from '#/lib/libraries'
import { useTags } from '#/lib/tags'

// `q` is the search that produced `from`, and it is what makes the picked book
// recoverable: the results are still in the query cache under it, and a cold
// cache simply runs the same deterministic search again. Carrying the whole
// result through the URL instead would put a JSON blob in the address bar and
// still lose it the moment somebody trimmed the link.
const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  from: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/libraries/$libraryId/books/new')({
  validateSearch: searchSchema,
  component: NewBook,
})

/**
 * Step two of adding a book, and the whole of adding one by hand.
 *
 * Arrives blank, or filled in from the search result named by `?from`. Nothing
 * saves yet - see the button at the foot of `BookForm`.
 */
function NewBook() {
  const { libraryId } = Route.useParams()
  const { data: library } = useLibrary(libraryId)

  return (
    <AppLayout
      breadcrumbs={<LibraryBreadcrumbs library={library} current="Add book" />}
      title="Add book"
    >
      <RequireAuth>
        <NewBookContent />
      </RequireAuth>
    </AppLayout>
  )
}

function NewBookContent() {
  const { libraryId } = Route.useParams()
  const { q, from } = Route.useSearch()
  const navigate = useNavigate()

  const query = q ?? ''
  const { data, isPending, isFetching } = useQuery(bookSearchQuery(query))
  const mediaTypes = useMediaTypes()
  const genres = useGenres()
  const tags = useTags(libraryId)

  const backToBooks = () => {
    void navigate({
      to: '/libraries/$libraryId/books',
      params: { libraryId },
    })
  }

  // `BookForm` reads its defaults once, so it must not be mounted while the
  // result it is meant to be filled in from is still being looked up - nor while
  // the lists its fields are drawn from are, since a `Select` handed an empty
  // list cannot show the value it already holds.
  //
  // The tags are in here with the two catalogues even though they are only
  // suggestions and a `TagsInput` handed none still works: a field that silently
  // offers nothing for the first second reads as a library with no tags, which
  // is a different and wrong answer.
  const waiting =
    (from && (isPending || isFetching)) ||
    mediaTypes.isPending ||
    genres.isPending ||
    tags.isPending

  if (waiting) {
    return (
      <Center mih={200}>
        <Loader />
      </Center>
    )
  }

  if (mediaTypes.error || genres.error || tags.error) {
    return (
      <Alert color="red" title="Could not load the book vocabulary">
        {(mediaTypes.error ?? genres.error ?? tags.error)?.message}
      </Alert>
    )
  }

  const picked = from
    ? (data?.find((result) => result.id === from) ?? null)
    : null

  return (
    <Stack gap="sm" maw={720}>
      {query ? (
        <Anchor
          component="button"
          type="button"
          fz="sm"
          // A button stretches across the stack and centres its own text.
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            void navigate({
              to: '/libraries/$libraryId/books/add',
              params: { libraryId },
              search: { q: query },
            })
          }}
        >
          <IconArrowLeft
            size={14}
            style={{ verticalAlign: 'middle', marginRight: 4 }}
          />
          Back to search
        </Anchor>
      ) : null}

      {/* A link that outlived its result - the provider dropped it, or somebody
          trimmed the URL. The form is still perfectly usable, so say what
          happened and leave them to it rather than showing an error page. */}
      {from && !picked ? (
        <Text fz="sm" c="dimmed">
          That result could not be found again, so this is a blank book.
        </Text>
      ) : null}

      <Card withBorder radius="md" padding="lg">
        <BookForm
          initial={picked ? draftFromResult(picked) : emptyDraft()}
          mediaTypes={mediaTypes.data}
          genres={genres.data}
          tags={tags.data}
          coverUrl={picked?.coverUrl ?? null}
          onCancel={backToBooks}
        />
      </Card>
    </Stack>
  )
}
