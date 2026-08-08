import { Link } from '@tanstack/react-router'
import { Anchor, Breadcrumbs, Text } from '@mantine/core'

/**
 * The way back out of a page under Settings.
 *
 * The `LibraryBreadcrumbs` equivalent for the admin section, and here for the
 * same reason: every settings page needs the identical trail, and three inlined
 * copies is three places for the target to drift. There is no skeleton branch
 * because nothing here is loaded - a settings page always knows where it is.
 */
export function SettingsBreadcrumbs({
  current,
}: Readonly<{ current: string }>) {
  return (
    <Breadcrumbs
      separator="/"
      separatorMargin="xs"
      fz="sm"
      styles={{ breadcrumb: { fontSize: 'var(--mantine-font-size-sm)' } }}
    >
      <Anchor
        component={Link}
        to="/admin/settings"
        c="dimmed"
        underline="hover"
      >
        Settings
      </Anchor>

      <Text c="dimmed" aria-current="page">
        {current}
      </Text>
    </Breadcrumbs>
  )
}
