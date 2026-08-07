import {
  Link,
  linkOptions,
  useParams,
  useRouterState,
} from '@tanstack/react-router'
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
  IconArrowsShuffle,
  IconBooks,
  IconDeviceDesktop,
  IconFileImport,
  IconLayoutDashboard,
  IconLibrary,
  IconMoon,
  IconSettings,
  IconStack2,
  IconSun,
  IconUserCircle,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react'

import { Mark } from '#/components/Mark'
import { useAuth } from '#/lib/auth'

import classes from './AppNav.module.css'

import type { MantineColorScheme } from '@mantine/core'
import type { TablerIcon } from '@tabler/icons-react'
import type { LinkProps } from '@tanstack/react-router'

interface NavItem {
  label: string
  icon: TablerIcon
  /**
   * Where the item goes, when it goes anywhere. Built with `linkOptions` so the
   * destination is checked against the route tree; items without one are not
   * built yet and say "Soon" rather than pretending.
   */
  link?: LinkProps
  /**
   * The pathname this item is "at", for deciding whether it is the current one.
   * Written out rather than derived, because a `to` like
   * `/libraries/$libraryId/books` is a template and never equals a real pathname.
   *
   * Matched exactly. "Libraries" stays unhighlighted while you are inside one,
   * because the child row you are actually on is the one lit up, and two
   * highlights would leave neither meaning anything.
   */
  activePath: string | null
  /** Rendered indented beneath the item, for a section of the app you are
   *  currently inside. */
  children?: NavItem[]
}

interface NavSection {
  label?: string
  items: NavItem[]
  /** Hidden entirely from a user who is not the instance admin. */
  adminOnly?: boolean
}

/**
 * What the navigation shows, given where you are.
 *
 * A function rather than a constant because the library you have open changes
 * it: the things that belong to one library - its books, its shelves, who it is
 * shared with - only make sense once there is a library to scope them to, and
 * they hang underneath it. Contributors and series stay at the top level; they
 * are catalogue metadata shared across every library, not part of any one.
 */
function sectionsFor(libraryId: string | undefined): NavSection[] {
  return [
    {
      items: [
        {
          label: 'Dashboard',
          icon: IconLayoutDashboard,
          link: linkOptions({ to: '/dashboard' }),
          activePath: '/dashboard',
        },
        {
          label: 'Libraries',
          icon: IconLibrary,
          link: linkOptions({ to: '/libraries' }),
          activePath: '/libraries',
          children: libraryId
            ? [
                {
                  label: 'Books',
                  icon: IconBooks,
                  link: linkOptions({
                    to: '/libraries/$libraryId/books',
                    params: { libraryId },
                  }),
                  activePath: `/libraries/${libraryId}/books`,
                },
                { label: 'Shelves', icon: IconStack2, activePath: null },
                { label: 'Loans', icon: IconArrowsShuffle, activePath: null },
                { label: 'Members', icon: IconUsersGroup, activePath: null },
              ]
            : undefined,
        },
        { label: 'Contributors', icon: IconUserCircle, activePath: null },
        { label: 'Series', icon: IconBooks, activePath: null },
      ],
    },
    {
      label: 'Tools',
      items: [{ label: 'Import', icon: IconFileImport, activePath: null }],
    },
    {
      label: 'Admin',
      adminOnly: true,
      items: [
        { label: 'Users', icon: IconUsers, activePath: null },
        { label: 'Settings', icon: IconSettings, activePath: null },
      ],
    },
  ]
}

/** Whether `item` is the page currently being looked at. */
function isActive(item: NavItem, pathname: string): boolean {
  return item.activePath !== null && pathname === item.activePath
}

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
 * One row of the navigation, and whatever hangs under it.
 *
 * An item with no `link` is not built yet and says so rather than 404ing.
 *
 * Children are rendered as siblings in an indented group, *not* through
 * Mantine's own `NavLink` nesting. A `NavLink` with children calls
 * `event.preventDefault()` on every click so it can toggle its collapse
 * instead - which would make "Libraries" un-clickable exactly when you are
 * inside a library. There is nothing to toggle here anyway: the children are
 * showing because of where you are, not because anyone opened them.
 */
function NavItemLink({
  item,
  pathname,
  onNavigate,
  nested = false,
}: Readonly<{
  item: NavItem
  pathname: string
  onNavigate?: () => void
  /** A child row. Highlighted with colour alone, so a filled parent and the
   *  current child do not merge into one block. */
  nested?: boolean
}>) {
  const link = item.link

  return (
    <>
      {link ? (
        <NavLink
          // `renderRoot` rather than `component={Link}`: Mantine's polymorphic
          // prop erases Link's own generics, and with them the check that
          // `params` matches the route's `$placeholders`.
          //
          // `exact` because Mantine styles `aria-current="page"` exactly as it
          // styles `data-active`, and Link sets it on prefix matches by
          // default - which lit "Libraries" up from inside a library, on top of
          // the child row that was genuinely current.
          renderRoot={(props) => (
            <Link {...link} activeOptions={{ exact: true }} {...props} />
          )}
          label={item.label}
          variant={nested ? 'subtle' : 'light'}
          leftSection={<item.icon size={18} stroke={1.6} />}
          active={isActive(item, pathname)}
          onClick={onNavigate}
        />
      ) : (
        <NavLink
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
      )}

      {item.children?.length ? (
        <Box className={classes.children}>
          {item.children.map((child) => (
            <NavItemLink
              key={child.label}
              item={child}
              pathname={pathname}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </Box>
      ) : null}
    </>
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
  // `strict: false` because this renders on every page, most of which have no
  // params at all.
  const { libraryId } = useParams({ strict: false })

  return (
    <>
      <Box flex={1} style={{ overflowY: 'auto' }} py="xs">
        {sectionsFor(libraryId)
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

              {section.items.map((item) => (
                <NavItemLink
                  key={item.label}
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
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
