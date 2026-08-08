import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Center, Loader } from '@mantine/core'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { RequireAuth } from '#/components/RequireAuth.tsx'
import { CataloguePanel } from '#/components/settings/CataloguePanel'
import { SettingsBreadcrumbs } from '#/components/settings/SettingsBreadcrumbs'
import {
  cacheEntry,
  createMediaType,
  deleteMediaType,
  forgetEntry,
  mediaTypesQueryKey,
  updateMediaType,
  useMediaTypes,
} from '#/lib/catalogue'

export const Route = createFileRoute('/admin/settings/media-types')({
  component: MediaTypesSettings,
})

function MediaTypesSettings() {
  return (
    <AppLayout
      breadcrumbs={<SettingsBreadcrumbs current="Media Types" />}
      title="Media Types"
      subtitle="Instance-wide media type catalogue. Delete is only allowed when no books are assigned."
    >
      {/* Admin-only, and checked here rather than in a route `beforeLoad`: the
          token does not exist there. The shell above still renders on the
          server for everyone. */}
      <RequireAuth isInstanceAdmin>
        <MediaTypesContent />
      </RequireAuth>
    </AppLayout>
  )
}

function MediaTypesContent() {
  const queryClient = useQueryClient()
  const { data: mediaTypes, isPending, error } = useMediaTypes()

  if (isPending) {
    return (
      <Center mih={200}>
        <Loader />
      </Center>
    )
  }

  if (error) {
    return (
      <Alert color="red" title="Could not load the media types">
        {error.message}
      </Alert>
    )
  }

  return (
    <CataloguePanel
      entries={mediaTypes}
      noun="media type"
      withDescription
      namePlaceholder="Display name…"
      descriptionPlaceholder="Description (optional)…"
      onCreate={async (draft) => {
        cacheEntry(
          queryClient,
          mediaTypesQueryKey,
          await createMediaType(draft),
        )
      }}
      onUpdate={async (id, draft) => {
        cacheEntry(
          queryClient,
          mediaTypesQueryKey,
          await updateMediaType(id, draft),
        )
      }}
      onDelete={async (entry) => {
        await deleteMediaType(entry.id)
        forgetEntry(queryClient, mediaTypesQueryKey, entry.id)
      }}
    />
  )
}
