import { createFileRoute, Link } from '@tanstack/react-router'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { RequireAuth } from '#/components/RequireAuth.tsx'
import { Anchor, Breadcrumbs, Text } from '@mantine/core'

export const Route = createFileRoute('/admin/settings/genres')({
  component: SettingsGeneralComponent,
})

function SettingsGeneralComponent() {
  return (
    <AppLayout
      title="General Settings"
      breadcrumbs={
        <Breadcrumbs
          separator="/"
          separatorMargin="xs"
          fz="sm"
          styles={{ breadcrumb: { fontSize: 'var(--mantine-font-size-sm)' } }}
        >
          <Anchor component={Link} to="/settings" c="dimmed" underline="hover">
            Settings
          </Anchor>
          <Text c="dimmed" aria-current="page">
            General
          </Text>
        </Breadcrumbs>
      }
    >
      <RequireAuth>
        <GeneralSettingsContent />
      </RequireAuth>
    </AppLayout>
  )
}

function GeneralSettingsContent() {
  return <></>
}
