import { Link } from '@tanstack/react-router'
import { Card, Group, Text, Tooltip } from '@mantine/core'
import { IconCrown } from '@tabler/icons-react'

import classes from './LibraryCard.module.css'

import type { Library } from '#/lib/libraries'

/**
 * One library in the list.
 *
 * The whole card is the link - a card with a link somewhere inside it gives the
 * reader a small target for what is obviously one clickable thing - and it goes
 * to the books, because that is what a library is for.
 *
 * The crown marks the primary owner. It carries no permission of its own: an
 * owner and the primary owner may do the same things, and the difference is
 * only that the primary owner cannot be removed from their own library.
 */
export function LibraryCard({ library }: Readonly<{ library: Library }>) {
  return (
    <Card
      // `renderRoot` rather than `component={Link}`: Mantine's polymorphic prop
      // erases Link's generics, and with them the check that `params` matches
      // the route's `$placeholders`.
      renderRoot={(props) => (
        <Link
          to="/libraries/$libraryId/books"
          params={{ libraryId: library.id }}
          {...props}
        />
      )}
      withBorder
      radius="md"
      padding="lg"
      h="100%"
      className={classes.card}
    >
      <Group gap={6} wrap="nowrap" align="center">
        {library.isPrimaryOwner ? (
          <Tooltip label="You own this library" withArrow>
            <IconCrown
              size={16}
              stroke={1.8}
              // Filled as well as stroked, so it reads as a badge rather than as
              // another line-art icon among the nav's.
              fill="var(--mantine-color-yellow-4)"
              color="var(--mantine-color-yellow-7)"
              aria-label="You own this library"
              role="img"
            />
          </Tooltip>
        ) : null}
        <Text fw={600} lineClamp={1}>
          {library.name}
        </Text>
      </Group>

      <Text fz="sm" c="dimmed" lineClamp={2} mt={6}>
        {library.description ?? 'No description'}
      </Text>
    </Card>
  )
}
