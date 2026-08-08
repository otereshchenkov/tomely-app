import { useState } from 'react'
import { Box, Center, Group, Image, Text } from '@mantine/core'
import { IconBook } from '@tabler/icons-react'

import type { BookSummary } from '#/lib/dashboard'
import type { ReactNode } from 'react'

const COVER_WIDTH = 36
const COVER_HEIGHT = 52

/**
 * A cover, or a stand-in of the same size while there is not one.
 *
 * The stand-in also covers a URL that does not load. Covers come from whoever
 * catalogued the book, so a dead one is ordinary rather than exceptional, and a
 * broken-image glyph in a list of books looks like the page is broken.
 *
 * `w`/`h` default to a list thumbnail; the add-book form asks for a larger one
 * beside the title.
 */
export function BookCover({
  book,
  w = COVER_WIDTH,
  h = COVER_HEIGHT,
}: Readonly<{ book: BookSummary; w?: number; h?: number }>) {
  const [failed, setFailed] = useState(false)

  if (!book.coverUrl || failed) {
    return (
      <Center
        w={w}
        h={h}
        bg="var(--mantine-color-default-hover)"
        style={{ borderRadius: 'var(--mantine-radius-sm)', flexShrink: 0 }}
      >
        <IconBook size={Math.round(h / 3)} stroke={1.5} opacity={0.5} />
      </Center>
    )
  }

  return (
    <Image
      key={book.coverUrl}
      src={book.coverUrl}
      alt=""
      w={w}
      h={h}
      radius="sm"
      fit="cover"
      onError={() => setFailed(true)}
      style={{ flexShrink: 0 }}
    />
  )
}

/**
 * One book in a list: cover, title, author, and whatever the panel wants to say
 * about it on the right.
 */
export function BookRow({
  book,
  meta,
  right,
}: Readonly<{
  book: BookSummary
  /** Replaces the author line when a panel has something better to say. */
  meta?: ReactNode
  right?: ReactNode
}>) {
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <BookCover book={book} />
      <Box style={{ minWidth: 0, flex: 1 }}>
        <Text fz="sm" fw={500} lineClamp={1}>
          {book.title}
        </Text>
        {meta ?? (
          <Text fz="xs" c="dimmed" lineClamp={1}>
            {book.authors.join(', ')}
          </Text>
        )}
      </Box>
      {right}
    </Group>
  )
}
