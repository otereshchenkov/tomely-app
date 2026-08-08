import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useDisclosure } from '@mantine/hooks'
import {
  Alert,
  Button,
  Card,
  Center,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core'

import { AppLayout } from '#/components/layout/AppLayout'
import { RequireAuth } from '#/components/RequireAuth'
import { DeleteLibraryModal } from '#/components/libraries/DeleteLibraryModal'
import { LibraryBreadcrumbs } from '#/components/libraries/LibraryBreadcrumbs'
import { LibraryDetailsForm } from '#/components/libraries/LibraryDetailsForm'
import { canManage, useLibrary } from '#/lib/libraries'

export const Route = createFileRoute('/libraries/$libraryId/settings')({
  component: LibrarySettings,
})

/**
 * What one library is called, and the end of it.
 *
 * No `loader`: the library needs a bearer token and there is none during SSR,
 * so the shell renders on the server and `RequireAuth` fills the content in
 * once the client knows who is asking. See CLAUDE.md.
 */
function LibrarySettings() {
  const { libraryId } = Route.useParams()
  const { data: library } = useLibrary(libraryId)

  return (
    <AppLayout
      breadcrumbs={<LibraryBreadcrumbs library={library} current="Settings" />}
      title="Settings"
    >
      <RequireAuth>
        <LibrarySettingsContent />
      </RequireAuth>
    </AppLayout>
  )
}

function LibrarySettingsContent() {
  const { libraryId } = Route.useParams()
  const { data: library, isPending, error } = useLibrary(libraryId)
  const navigate = useNavigate()
  const [confirming, { open: askToDelete, close: stopAsking }] =
    useDisclosure(false)

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

  // The API is the rule; this only decides what to offer. A member who is not
  // an owner still gets the page - it is the readable record of what the
  // library is - with the fields filled in and nothing to press.
  const manageable = canManage(library)

  return (
    <>
      <Stack gap="lg" maw={640}>
        <Card withBorder radius="md" padding="lg">
          <LibraryDetailsForm library={library} readOnly={!manageable} />
        </Card>

        {manageable ? (
          <Card withBorder radius="md" padding="lg">
            <Stack gap="xs" align="flex-start">
              <Title order={2} fz="h5" c="red">
                Delete this library
              </Title>
              <Text fz="sm" c="dimmed">
                Everything in it goes with it, and this cannot be undone.
              </Text>
              <Button
                color="red"
                variant="outline"
                mt="xs"
                onClick={askToDelete}
              >
                Delete library
              </Button>
            </Stack>
          </Card>
        ) : null}
      </Stack>

      <DeleteLibraryModal
        library={library}
        opened={confirming}
        onClose={stopAsking}
        // Straight to the list, and `replace`: the page for a library that no
        // longer exists must not be one step back on the history stack.
        //
        // The modal has already dropped `['libraries', id]` by the time this
        // runs, so this component re-renders pending for one commit and fires
        // one refetch whose answer nobody reads. Leaving immediately keeps that
        // to a frame; latching a "deleted" flag to suppress it would be more
        // machinery than the frame is worth.
        onDeleted={() => {
          void navigate({ to: '/libraries', replace: true })
        }}
      />
    </>
  )
}
