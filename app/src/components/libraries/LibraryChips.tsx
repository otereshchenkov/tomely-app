import { Link } from '@tanstack/react-router'
import { Button, Group } from '@mantine/core'
import { IconArrowRight } from '@tabler/icons-react'

import type { Library } from '#/lib/libraries'

/**
 * The libraries you can get at, as a row of chips.
 *
 * A shortcut rather than a listing: the dashboard is where you land, and the
 * thing you most likely came to do is open one. Each goes straight to its books,
 * the same place a card on `/libraries` goes, with "View all" for everything
 * else you might want to do with them.
 *
 * Ownership is deliberately not marked here. The crown belongs on the cards,
 * where there is room for it to mean something; a row of chips is a way through
 * to somewhere, not a place to read anything off.
 */
export function LibraryChips({
  libraries,
}: Readonly<{ libraries: Array<Library> }>) {
  return (
    <Group gap="xs">
      {libraries.map((library) => (
        <Button
          key={library.id}
          // `renderRoot` rather than `component={Link}`: Mantine's polymorphic
          // prop erases Link's generics, and with them the check that `params`
          // matches the route's `$placeholders`.
          renderRoot={(props) => (
            <Link
              to="/libraries/$libraryId/books"
              params={{ libraryId: library.id }}
              {...props}
            />
          )}
          variant="outline"
          radius="xl"
          size="compact-sm"
        >
          {library.name}
        </Button>
      ))}

      <Button
        component={Link}
        to="/libraries"
        variant="subtle"
        radius="xl"
        size="compact-sm"
        rightSection={<IconArrowRight size={14} />}
      >
        View all
      </Button>
    </Group>
  )
}
