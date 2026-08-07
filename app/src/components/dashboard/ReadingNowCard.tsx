import { Card, Center, Progress, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconBookmark } from '@tabler/icons-react'

import { BookRow } from './BookRow'

import type { ReadingBook } from '#/lib/dashboard'

/**
 * The centrepiece: what you are in the middle of. Its empty state is the one
 * most people will see first, so it gets the whole panel rather than a line of
 * grey text.
 */
export function ReadingNowCard({ books }: Readonly<{ books: ReadingBook[] }>) {
  return (
    <Card withBorder radius="md" padding="lg" h="100%" mih={220}>
      {books.length === 0 ? (
        <Center h="100%" mih={180}>
          <Stack align="center" gap="xs" maw={320}>
            <ThemeIcon variant="light" radius="xl" size={52}>
              <IconBookmark size={26} stroke={1.6} />
            </ThemeIcon>
            <Text fw={600}>No books in progress</Text>
            <Text c="dimmed" size="sm" ta="center">
              {'Mark a book as "Reading" and it will show up here.'}
            </Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="md">
          {books.map((book) => (
            <BookRow
              key={book.id}
              book={book}
              meta={
                <Stack gap={4} mt={2}>
                  <Text fz="xs" c="dimmed" lineClamp={1}>
                    {book.authors.join(', ')}
                  </Text>
                  <Progress
                    value={book.progress}
                    size="sm"
                    radius="xl"
                    aria-label={`${book.progress}% read`}
                  />
                </Stack>
              }
              right={
                <Text fz="xs" c="dimmed" fw={500}>
                  {book.progress}%
                </Text>
              }
            />
          ))}
        </Stack>
      )}
    </Card>
  )
}
