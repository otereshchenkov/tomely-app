import { Link, useRouterState } from '@tanstack/react-router'
import {
  Anchor,
  Badge,
  Box,
  Divider,
  Group,
  NavLink,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconBooks,
  IconDeviceDesktop,
  IconFileImport,
  IconLayoutDashboard,
  IconLibrary,
  IconMoon,
  IconSettings,
  IconSun,
  IconUsers,
} from '@tabler/icons-react'

import { Mark } from '#/components/Mark'
import { useAuth } from '#/lib/auth'

import type { MantineColorScheme } from '@mantine/core'
import type { TablerIcon } from '@tabler/icons-react'
import type { LinkProps } from '@tanstack/react-router'

interface NavItem {
  label: string
  icon: TablerIcon
  /**
   * Where the item goes, when it goes anywhere. Only the dashboard exists so
   * far; the rest are here because the shape of the navigation is part of the
   * design, and they say "Soon" rather than pretending.
   */
  to?: LinkProps['to']
}

interface NavSection {
  label?: string
  items: NavItem[]
  /** Hidden entirely from a user who is not the instance admin. */
  adminOnly?: boolean
}

const sections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', icon: IconLayoutDashboard, to: '/dashboard' },
      { label: 'Books', icon: IconBooks },
      { label: 'Shelves', icon: IconLibrary },
    ],
  },
  {
    label: 'Tools',
    items: [{ label: 'Import', icon: IconFileImport }],
  },
  {
    label: 'Admin',
    adminOnly: true,
    items: [
      { label: 'Users', icon: IconUsers },
      { label: 'Settings', icon: IconSettings },
    ],
  },
]

/** The wordmark, shared by the navbar, the mobile header and the drawer. */
export function Brand() {
  return (
    <Group gap="xs" wrap="nowrap">
      <Mark size={30} />
      <Text fw={700} fz="lg" lh={1}>
        Tomely
      </Text>
    </Group>
  )
}

/**
 * The navigation itself: the same markup in the desktop navbar and in the
 * mobile drawer, so there is one place to add a destination.
 *
 * `onNavigate` is what the drawer passes to close itself on a tap; the navbar
 * leaves it out.
 */
export function AppNav({ onNavigate }: Readonly<{ onNavigate?: () => void }>) {
  const { user } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <>
      <Box flex={1} style={{ overflowY: 'auto' }} py="xs">
        {sections
          .filter((section) => !section.adminOnly || user?.isInstanceAdmin)
          .map((section) => (
            <Box key={section.label ?? 'main'} mb="xs">
              {section.label ? (
                <Text
                  tt="uppercase"
                  fz="xs"
                  fw={700}
                  c="dimmed"
                  px="md"
                  pt="sm"
                  pb={6}
                >
                  {section.label}
                </Text>
              ) : null}

              {section.items.map((item) =>
                item.to ? (
                  <NavLink
                    key={item.label}
                    component={Link}
                    to={item.to}
                    label={item.label}
                    leftSection={<item.icon size={18} stroke={1.6} />}
                    active={pathname === item.to}
                    variant="light"
                    onClick={onNavigate}
                  />
                ) : (
                  <NavLink
                    key={item.label}
                    component="button"
                    type="button"
                    label={item.label}
                    leftSection={<item.icon size={18} stroke={1.6} />}
                    rightSection={
                      <Badge size="xs" variant="default" fw={500}>
                        Soon
                      </Badge>
                    }
                    disabled
                  />
                ),
              )}
            </Box>
          ))}
      </Box>

      <UserPanel />
    </>
  )
}

/**
 * The foot of the navigation: who you are, and the two things you can do about
 * it. Rendered only once the client knows the answer, which also keeps the
 * colour-scheme control - whose label comes from `localStorage` - out of the
 * server-rendered HTML.
 */
function UserPanel() {
  const { user, signOut } = useAuth()

  if (!user) return null

  return (
    <Box>
      <Divider />
      <Stack gap={6} p="md">
        <Box>
          <Text fz="sm" fw={600} truncate>
            {user.displayName}
          </Text>
          <Text fz="xs" c="dimmed" truncate>
            {user.email}
          </Text>
        </Box>

        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Anchor component="button" type="button" fz="xs" onClick={signOut}>
            Sign out
          </Anchor>
          <Group gap="md" wrap="nowrap">
            <Tooltip label="Not built yet" withArrow>
              <Text fz="xs" c="dimmed">
                Profile
              </Text>
            </Tooltip>
            <ColorSchemeControl />
          </Group>
        </Group>
      </Stack>
    </Box>
  )
}

const schemeOrder: MantineColorScheme[] = ['auto', 'light', 'dark']

const schemeLabels: Record<
  MantineColorScheme,
  { label: string; icon: TablerIcon }
> = {
  auto: { label: 'Auto', icon: IconDeviceDesktop },
  light: { label: 'Light', icon: IconSun },
  dark: { label: 'Dark', icon: IconMoon },
}

/** Cycles auto -> light -> dark. "Auto" is a real choice, so it is a cycle
 *  rather than a two-state switch. */
function ColorSchemeControl() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const current = schemeLabels[colorScheme]
  const next = schemeOrder[(schemeOrder.indexOf(colorScheme) + 1) % 3]
  const Icon = current.icon

  return (
    <Tooltip label={`Switch to ${schemeLabels[next].label.toLowerCase()}`}>
      <UnstyledButton
        onClick={() => setColorScheme(next)}
        aria-label={`Colour scheme: ${current.label}. Switch to ${schemeLabels[next].label.toLowerCase()}.`}
      >
        <Group gap={4} wrap="nowrap" c="dimmed">
          <Icon size={14} stroke={1.6} />
          <Text fz="xs" c="dimmed">
            {current.label}
          </Text>
        </Group>
      </UnstyledButton>
    </Tooltip>
  )
}
