import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Center, Loader } from '@mantine/core'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { RequireAuth } from '#/components/RequireAuth.tsx'
import { CataloguePanel } from '#/components/settings/CataloguePanel'
import { SettingsBreadcrumbs } from '#/components/settings/SettingsBreadcrumbs'
import {
  asEntries,
  cacheEntry,
  createGenre,
  deleteGenre,
  forgetEntry,
  genresQueryKey,
  updateGenre,
  useGenres,
} from '#/lib/catalogue'

export const Route = createFileRoute('/admin/settings/genres')({
  component: GenresSettings,
})

function GenresSettings() {
  return (
    <AppLayout
      breadcrumbs={<SettingsBreadcrumbs current="Genres" />}
      title="Genres"
      subtitle="Instance-wide genre catalogue shared across all libraries."
    >
      <RequireAuth isInstanceAdmin>
        <GenresContent />
      </RequireAuth>
    </AppLayout>
  )
}

function GenresContent() {
  const queryClient = useQueryClient()
  const { data: genres, isPending, error } = useGenres()

  if (isPending) {
    return (
      <Center mih={200}>
        <Loader />
      </Center>
    )
  }

  if (error) {
    return (
      <Alert color="red" title="Could not load the genres">
        {error.message}
      </Alert>
    )
  }

  return (
    <CataloguePanel
      // A genre has no description, so it is widened to the shape the shared
      // panel draws rather than the panel learning which catalogue it has.
      entries={asEntries(genres)}
      noun="genre"
      namePlaceholder="New genre name…"
      onCreate={async (draft) => {
        cacheEntry(queryClient, genresQueryKey, await createGenre(draft))
      }}
      onUpdate={async (id, draft) => {
        cacheEntry(queryClient, genresQueryKey, await updateGenre(id, draft))
      }}
      onDelete={async (entry) => {
        await deleteGenre(entry.id)
        forgetEntry(queryClient, genresQueryKey, entry.id)
      }}
    />
  )
}
