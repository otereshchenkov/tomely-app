import { createFileRoute } from '@tanstack/react-router'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { RequireAuth } from '#/components/RequireAuth.tsx'
import { SettingsBreadcrumbs } from '#/components/settings/SettingsBreadcrumbs'

export const Route = createFileRoute('/admin/settings/general')({
  component: GeneralSettings,
})

function GeneralSettings() {
  return (
    <AppLayout
      breadcrumbs={<SettingsBreadcrumbs current="General" />}
      title="General Settings"
    >
      <RequireAuth isInstanceAdmin>
        <GeneralSettingsContent />
      </RequireAuth>
    </AppLayout>
  )
}

// Nothing to configure yet. The page exists because the settings grid links to
// it, and an item that goes nowhere should land somewhere that says so rather
// than 404.
function GeneralSettingsContent() {
  return <></>
}
