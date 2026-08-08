import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useDisclosure } from '@mantine/hooks'
import {
  Alert,
  Button,
  Card,
  Center,
  Loader,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { IconSettings, IconTags } from '@tabler/icons-react'
import { z } from 'zod'

import { AppLayout } from '#/components/layout/AppLayout'
import { RequireAuth } from '#/components/RequireAuth'
import { DeleteLibraryModal } from '#/components/libraries/DeleteLibraryModal'
import { LibraryBreadcrumbs } from '#/components/libraries/LibraryBreadcrumbs'
import { LibraryDetailsForm } from '#/components/libraries/LibraryDetailsForm'
import { TagsPanel } from '#/components/libraries/TagsPanel'
import { cacheEntry, forgetEntry } from '#/lib/catalogue'
import { canEdit, canManage, useLibrary } from '#/lib/libraries'
import {
  createTag,
  deleteTag,
  tagsQueryKey,
  updateTag,
  useTags,
} from '#/lib/tags'

import type { Library } from '#/lib/libraries'

/**
 * Which tab, in the URL.
 *
 * `.catch(undefined)` so a value that is not one of these degrades to General
 * rather than erroring the route, the way `/libraries`' `?new` does. In the
 * address bar rather than in `useState` because a settings tab is a place: it
 * should survive a reload, come back with the back button, and be linkable to
 * somebody who needs to look at it.
 */
const searchSchema = z.object({
  tab: z.enum(['general', 'tags']).optional().catch(undefined),
})

export const Route = createFileRoute('/libraries/$libraryId/settings')({
  validateSearch: searchSchema,
  component: LibrarySettings,
})

/**
 * What one library is called, what may be filed in it, and the end of it.
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
  const { tab } = Route.useSearch()
  const navigate = useNavigate()
  const { data: library, isPending, error } = useLibrary(libraryId)

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
    <Tabs
      value={tab ?? 'general'}
      // `replace`, so flicking between two tabs does not build a history stack
      // the back button then has to be pressed through to leave the page.
      onChange={(next) => {
        void navigate({
          to: '/libraries/$libraryId/settings',
          params: { libraryId },
          search: { tab: next === 'general' ? undefined : 'tags' },
          replace: true,
        })
      }}
    >
      <Tabs.List mb="lg">
        <Tabs.Tab value="general" leftSection={<IconSettings size={16} />}>
          General
        </Tabs.Tab>
        <Tabs.Tab value="tags" leftSection={<IconTags size={16} />}>
          Tags
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="general">
        <GeneralTab library={library} />
      </Tabs.Panel>

      <Tabs.Panel value="tags">
        <TagsTab library={library} />
      </Tabs.Panel>
    </Tabs>
  )
}

/** What the library is called, and the end of it. */
function GeneralTab({ library }: Readonly<{ library: Library }>) {
  const navigate = useNavigate()
  const [confirming, { open: askToDelete, close: stopAsking }] =
    useDisclosure(false)

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

/**
 * The words this library files things under.
 *
 * The route owns the queries and the cache and `TagsPanel` owns the
 * interaction, which is the split every other panel here uses. `cacheEntry` and
 * `forgetEntry` come from `catalogue.ts` because they never cared what they were
 * holding - they take the key, and the tags' key is the library's own with
 * `'tags'` on the end.
 */
function TagsTab({ library }: Readonly<{ library: Library }>) {
  const queryClient = useQueryClient()
  const { data: tags, isPending, error } = useTags(library.id)
  const key = tagsQueryKey(library.id)

  if (isPending) {
    return (
      <Center mih={200}>
        <Loader />
      </Center>
    )
  }

  if (error) {
    return (
      <Alert color="red" title="Could not load this library's tags">
        {error.message}
      </Alert>
    )
  }

  return (
    <Stack gap="md" maw={600}>
      <Text fz="sm" c="dimmed">
        Library-specific tags for books, shelves, loans, and members. Deleting a
        tag removes it from all items in the library.
      </Text>

      <TagsPanel
        tags={tags}
        readOnly={!canEdit(library)}
        onCreate={async (draft) => {
          cacheEntry(queryClient, key, await createTag(library.id, draft))
        }}
        onUpdate={async (id, draft) => {
          cacheEntry(queryClient, key, await updateTag(library.id, id, draft))
        }}
        onDelete={async (tag) => {
          await deleteTag(library.id, tag.id)
          forgetEntry(queryClient, key, tag.id)
        }}
      />
    </Stack>
  )
}
