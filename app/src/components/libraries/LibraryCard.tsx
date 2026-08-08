import { Link } from '@tanstack/react-router'
import {
  ActionIcon,
  Anchor,
  Card,
  Group,
  Menu,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconCrown, IconDots, IconPencil, IconTrash } from '@tabler/icons-react'

import { canManage } from '#/lib/libraries'

import classes from './LibraryCard.module.css'

import type { Library } from '#/lib/libraries'

/**
 * One library in the list.
 *
 * The whole card is the target - a card with a link somewhere inside it gives
 * the reader a small target for what is obviously one clickable thing - and it
 * goes to the books, because that is what a library is for. But the link itself
 * wraps only the name and is *stretched* over the card by a pseudo-element,
 * rather than being the card's own root element. That is what leaves room for
 * the menu: a button inside an anchor is markup the spec forbids, and every
 * click on it would have to be talked out of navigating. As siblings, with the
 * button sitting above the overlay, neither has to know about the other.
 *
 * The crown marks the primary owner. It carries no permission of its own: an
 * owner and the primary owner may do the same things, and the difference is
 * only that the primary owner cannot be removed from their own library.
 */
export function LibraryCard({
  library,
  onDelete,
}: Readonly<{
  library: Library
  /** Opens the confirmation. The card does not own that dialog: it has to
   *  outlive the card it is about, and the card unmounts the moment the
   *  deletion lands. */
  onDelete?: () => void
}>) {
  return (
    <Card withBorder radius="md" padding="lg" h="100%" className={classes.card}>
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
        <Group gap={6} wrap="nowrap" align="center" miw={0}>
          {library.isPrimaryOwner ? (
            <Tooltip label="You own this library" withArrow>
              <IconCrown
                size={16}
                stroke={1.8}
                // Filled as well as stroked, so it reads as a badge rather than
                // as another line-art icon among the nav's.
                fill="var(--mantine-color-yellow-4)"
                color="var(--mantine-color-yellow-7)"
                aria-label="You own this library"
                role="img"
              />
            </Tooltip>
          ) : null}

          <Anchor
            // `renderRoot` rather than `component={Link}`: Mantine's
            // polymorphic prop erases Link's generics, and with them the check
            // that `params` matches the route's `$placeholders`.
            renderRoot={(props) => (
              <Link
                to="/libraries/$libraryId/books"
                params={{ libraryId: library.id }}
                {...props}
              />
            )}
            className={classes.link}
            underline="never"
          >
            <Text fw={600} lineClamp={1}>
              {library.name}
            </Text>
          </Anchor>
        </Group>

        {/* Hidden for anyone who may not use it, which is presentation only -
            the API is what actually refuses them. */}
        {canManage(library) ? (
          <Menu shadow="md" position="bottom-end" withArrow>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                className={classes.menu}
                // Named per card: "Options", read out six times down a list, is
                // not something anyone can navigate by.
                aria-label={`Options for ${library.name}`}
              >
                <IconDots size={16} stroke={1.8} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconPencil size={14} stroke={1.8} />}
                renderRoot={(props) => (
                  <Link
                    to="/libraries/$libraryId/settings"
                    params={{ libraryId: library.id }}
                    {...props}
                  />
                )}
              >
                Edit
              </Menu.Item>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} stroke={1.8} />}
                onClick={onDelete}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : null}
      </Group>

      <Text fz="sm" c="dimmed" lineClamp={2} mt={6}>
        {library.description ?? 'No description'}
      </Text>
    </Card>
  )
}
