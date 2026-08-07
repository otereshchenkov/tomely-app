import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useDisclosure } from '@mantine/hooks'
import { z } from 'zod'
import {
  Alert,
  Button,
  Card,
  Center,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'

import { AppLayout } from '#/components/layout/AppLayout'
import { RequireAuth } from '#/components/RequireAuth'
import { LibraryCard } from '#/components/libraries/LibraryCard'
import { NewLibraryModal } from '#/components/libraries/NewLibraryModal'
import { useLibraries } from '#/lib/libraries'

/**
 * `?new` opens the create dialog on arrival, so somewhere else can send you here
 * to make one - the dashboard's "create your first library" does exactly that.
 *
 * `.catch` rather than a hard failure: a malformed value should mean "no dialog",
 * not a broken page.
 */
const searchSchema = z.object({
  new: z.boolean().optional().catch(undefined),
})

export const Route = createFileRoute('/libraries/')({
  validateSearch: searchSchema,
  component: Libraries,
})

/**
 * Every library you can get at.
 *
 * No `loader`: the list needs a bearer token and there is none during SSR, so
 * the shell renders on the server and `RequireAuth` fills the content in once
 * the client knows who is asking. See CLAUDE.md.
 */
function Libraries() {
  const [opened, { open, close }] = useDisclosure(false)
  const { new: openOnArrival } = Route.useSearch()
  const navigate = useNavigate()
  // Safe to call outside `RequireAuth` - the query does not run until the
  // session resolves - and it is what puts the count in the title bar.
  const { data: libraries } = useLibraries()

  useEffect(() => {
    if (openOnArrival) open()
  }, [openOnArrival, open])

  // Drop the search param on the way out, so reloading the page or coming back
  // to it does not reopen a dialog the reader has already dismissed.
  const closeAndForget = () => {
    close()
    if (openOnArrival) {
      void navigate({ to: '/libraries', search: {}, replace: true })
    }
  }

  return (
    <>
      <AppLayout
        title="Libraries"
        subtitle={
          libraries
            ? `${libraries.length} ${libraries.length === 1 ? 'library' : 'libraries'}`
            : undefined
        }
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            New library
          </Button>
        }
      >
        <RequireAuth>
          <LibrariesContent onCreate={open} />
        </RequireAuth>
      </AppLayout>

      <NewLibraryModal opened={opened} onClose={closeAndForget} />
    </>
  )
}

function LibrariesContent({ onCreate }: Readonly<{ onCreate: () => void }>) {
  const { data: libraries, isPending, error } = useLibraries()

  if (isPending) {
    return (
      <Center mih={200}>
        <Loader />
      </Center>
    )
  }

  if (error) {
    return (
      <Alert color="red" title="Could not load your libraries">
        {error.message}
      </Alert>
    )
  }

  if (libraries.length === 0) {
    return <EmptyLibraries onCreate={onCreate} />
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {libraries.map((library) => (
        <LibraryCard key={library.id} library={library} />
      ))}
    </SimpleGrid>
  )
}

/**
 * A dashed placeholder where the first card will go.
 *
 * It offers the same button the title bar does. That is deliberate duplication:
 * on an empty page the one thing to do should be in the middle of it, not only
 * tucked into a corner.
 */
function EmptyLibraries({ onCreate }: Readonly<{ onCreate: () => void }>) {
  return (
    <Card withBorder radius="md" padding="xl" style={{ borderStyle: 'dashed' }}>
      <Stack gap="xs" align="center" py="xl">
        <Title order={2} fz="h4">
          No libraries yet
        </Title>
        <Text c="dimmed" fz="sm">
          Create one to get started.
        </Text>
        <Button mt="sm" onClick={onCreate}>
          New library
        </Button>
      </Stack>
    </Card>
  )
}
