import { Box, Center, Group, Image, Text } from '@mantine/core'
import { IconBook } from '@tabler/icons-react'

import type { BookSummary } from '#/lib/dashboard'
import type { ReactNode } from 'react'

const COVER_WIDTH = 36
const COVER_HEIGHT = 52

/** A cover, or a stand-in of the same size while there is not one. */
export function BookCover({ book }: Readonly<{ book: BookSummary }>) {
  if (!book.coverUrl) {
    return (
      <Center
        w={COVER_WIDTH}
        h={COVER_HEIGHT}
        bg="var(--mantine-color-default-hover)"
        style={{ borderRadius: 'var(--mantine-radius-sm)', flexShrink: 0 }}
      >
        <IconBook size={18} stroke={1.5} opacity={0.5} />
      </Center>
    )
  }

  return (
    <Image
      src={book.coverUrl}
      alt=""
      w={COVER_WIDTH}
      h={COVER_HEIGHT}
      radius="sm"
      fit="cover"
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
