import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Alert, Button, Card, Center, Loader, Stack, Text } from '@mantine/core'

import { AppLayout } from '#/components/layout/AppLayout'
import { RequireAuth } from '#/components/RequireAuth'
import { BooksToolbar } from '#/components/books/BooksToolbar'
import { LibraryBreadcrumbs } from '#/components/libraries/LibraryBreadcrumbs'
import { useLibrary } from '#/lib/libraries'

export const Route = createFileRoute('/libraries/$libraryId/books/')({
  component: LibraryBooks,
})

/**
 * The books in one library.
 *
 * Still a stub - there is no books endpoint yet - but a stub with the shape the
 * page will keep: a toolbar across the top, a shelf below it. Everything in the
 * toolbar except "Add book" is disabled and marked "Soon"; see `BooksToolbar`.
 *
 * The toolbar sits beside `RequireAuth` rather than inside it. It needs no
 * session, so it belongs in the server-rendered HTML for the same reason the
 * layout does, and it means the page does not rearrange itself once the client
 * works out who is asking.
 */
function LibraryBooks() {
  const { libraryId } = Route.useParams()
  const { data: library } = useLibrary(libraryId)
  const navigate = useNavigate()

  // One handler for both ways in, the way `libraries.index.tsx` shares one
  // between its title-bar button and its empty state.
  const addBook = () => {
    void navigate({
      to: '/libraries/$libraryId/books/add',
      params: { libraryId },
    })
  }

  return (
    <AppLayout
      breadcrumbs={<LibraryBreadcrumbs library={library} current="Books" />}
      title="Books"
    >
      <Stack gap="md">
        <BooksToolbar onAddBook={addBook} />
        <RequireAuth>
          <LibraryBooksContent onAddBook={addBook} />
        </RequireAuth>
      </Stack>
    </AppLayout>
  )
}

function LibraryBooksContent({
  onAddBook,
}: Readonly<{ onAddBook: () => void }>) {
  const { libraryId } = Route.useParams()
  const { isPending, error } = useLibrary(libraryId)

  if (isPending) {
    return (
      <Center mih={200}>
        <Loader />
      </Center>
    )
  }

  if (error) {
    return (
      <Alert color="red" title="Could not load this library">
        {error.message}
      </Alert>
    )
  }

  return <EmptyBooks onAddBook={onAddBook} />
}

/**
 * A dashed placeholder where the shelf will go.
 *
 * It repeats the toolbar's "Add book", which is deliberate: on an empty page the
 * one thing to do should be in the middle of it, not only tucked into a corner.
 * `EmptyLibraries` in `libraries.index.tsx` makes the same argument.
 */
function EmptyBooks({ onAddBook }: Readonly<{ onAddBook: () => void }>) {
  return (
    <Card withBorder radius="md" padding="xl" style={{ borderStyle: 'dashed' }}>
      <Stack gap="md" align="center" py="xl">
        <Text c="dimmed">No books yet</Text>
        <Button onClick={onAddBook}>Add your first book</Button>
      </Stack>
    </Card>
  )
}
