import { Link } from '@tanstack/react-router'
import { Anchor, Breadcrumbs, Skeleton, Text } from '@mantine/core'

import type { Library } from '#/lib/libraries'

/**
 * The way back out of a page that lives inside a library.
 *
 * The library's own crumb points at its books, which is the closest thing it
 * has to a front page. On the books page that is a link to where you already
 * are - harmless, and it is the right target from every other section once
 * shelves, loans and members exist.
 *
 * `library` is undefined until the client has fetched it, so its crumb holds a
 * skeleton of roughly the right width rather than collapsing and shoving the
 * rest of the trail sideways a moment later.
 */
export function LibraryBreadcrumbs({
  library,
  current,
}: Readonly<{ library: Library | undefined; current: string }>) {
  return (
    <Breadcrumbs
      separator="/"
      separatorMargin="xs"
      fz="sm"
      styles={{ breadcrumb: { fontSize: 'var(--mantine-font-size-sm)' } }}
    >
      <Anchor component={Link} to="/libraries" c="dimmed" underline="hover">
        Libraries
      </Anchor>

      {library ? (
        <Anchor
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
          c="dimmed"
          underline="hover"
          lineClamp={1}
        >
          {library.name}
        </Anchor>
      ) : (
        <Skeleton height={10} width={90} radius="xl" />
      )}

      <Text c="dimmed" aria-current="page">
        {current}
      </Text>
    </Breadcrumbs>
  )
}
