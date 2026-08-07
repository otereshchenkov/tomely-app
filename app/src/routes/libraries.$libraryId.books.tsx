import { createFileRoute } from '@tanstack/react-router'
import { Alert, Card, Center, Loader, Text } from '@mantine/core'

import { AppLayout } from '#/components/layout/AppLayout'
import { RequireAuth } from '#/components/RequireAuth'
import { LibraryBreadcrumbs } from '#/components/libraries/LibraryBreadcrumbs'
import { useLibrary } from '#/lib/libraries'

export const Route = createFileRoute('/libraries/$libraryId/books')({
  component: LibraryBooks,
})

/**
 * The books in one library.
 *
 * A stub: there is no books endpoint yet. It exists because the navigation and
 * the library cards need somewhere real to point, and because being inside a
 * library is what makes the nav show that library's sections.
 */
function LibraryBooks() {
  const { libraryId } = Route.useParams()
  const { data: library } = useLibrary(libraryId)

  return (
    <AppLayout
      breadcrumbs={<LibraryBreadcrumbs library={library} current="Books" />}
      title="Books"
    >
      <RequireAuth>
        <LibraryBooksContent />
      </RequireAuth>
    </AppLayout>
  )
}

function LibraryBooksContent() {
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

  return (
    <Card withBorder radius="md" padding="lg">
      <Text c="dimmed" size="sm">
        No books yet. Adding them is not built yet.
      </Text>
    </Card>
  )
}
