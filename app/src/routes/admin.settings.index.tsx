import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { RequireAuth } from '#/components/RequireAuth.tsx'
import { SimpleGrid } from '@mantine/core'

import { IconSettings, IconDna2, IconFileTypography } from '@tabler/icons-react'
import { SettingCard } from '#/components/settings/SettingsCard.tsx'

export const Route = createFileRoute('/admin/settings/')({
  component: SettingsComponent,
})

function SettingsComponent() {
  return (
    <AppLayout title="Settings">
      <RequireAuth isInstanceAdmin={true}>
        <SettingsContent />
      </RequireAuth>
    </AppLayout>
  )
}

function SettingsContent() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      <SettingCard
        title={'General Settings'}
        icon={<IconSettings />}
        description={'General settings for your library account'}
        link={'/admin/settings/general'}
      />
      <SettingCard
        title={'Media Types'}
        icon={<IconFileTypography />}
        description={'Instance-wide media type catalogue.'}
        link={'/admin/settings/media-types'}
      />
      <SettingCard
        title={'Genres'}
        icon={<IconDna2 />}
        description={
          'Instance-wide genre catalogue shared across all libraries.'
        }
        link={'/admin/settings/genres'}
      />
    </SimpleGrid>
  )
}
