import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Button,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'

import { AppLayout } from '#/components/layout/AppLayout'
import { RequireAuth } from '#/components/RequireAuth'
import { BookRow } from '#/components/dashboard/BookRow'
import { ReadingNowCard } from '#/components/dashboard/ReadingNowCard'
import { EmptyLine, SectionCard } from '#/components/dashboard/SectionCard'
import { StatTile } from '#/components/dashboard/StatTile'
import { YearInBooksCard } from '#/components/dashboard/YearInBooksCard'
import { useAuth } from '#/lib/auth'
import { useDashboard } from '#/lib/dashboard'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

/**
 * The shell renders for everyone - it is part of the server-rendered HTML - and
 * `RequireAuth` decides, once the client knows who is asking, whether to fill it
 * in or send them to sign in.
 */
function Dashboard() {
  const { user } = useAuth()

  return (
    <AppLayout title={user ? `Welcome back, ${user.displayName}` : 'Dashboard'}>
      <RequireAuth>
        <DashboardContent />
      </RequireAuth>
    </AppLayout>
  )
}

function DashboardContent() {
  // `RequireAuth` means this only ever renders in the browser, so reading the
  // clock here cannot disagree with server-rendered markup. Pinned in state so
  // a re-render around midnight does not shuffle the chart under the reader.
  const [now] = useState(() => new Date())
  const dashboard = useDashboard(now)
  const { stats } = dashboard

  return (
    <Stack gap="md">
      {dashboard.libraryCount === 0 ? (
        <Group>
          <Tooltip label="Libraries are not built yet" withArrow>
            <Button
              variant="default"
              radius="xl"
              size="compact-sm"
              leftSection={<IconPlus size={14} />}
              style={{ borderStyle: 'dashed' }}
              // `data-disabled` rather than `disabled`, so the tooltip
              // explaining why still opens; `aria-disabled` says the same thing
              // to anyone not using a pointer.
              data-disabled
              aria-disabled
              onClick={(event) => event.preventDefault()}
            >
              Create your first library
            </Button>
          </Tooltip>
        </Group>
      ) : null}

      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <ReadingNowCard books={dashboard.currentlyReading} />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            <YearInBooksCard
              year={now.getFullYear()}
              finished={dashboard.finishedThisYear}
              months={dashboard.finishedByMonth}
            />
            <SimpleGrid cols={2} spacing="md">
              <StatTile
                value={stats.reading}
                label="Reading"
                color="indigo.6"
              />
              <StatTile
                value={stats.favourites}
                label="Favourites"
                color="red.7"
              />
              <StatTile value={stats.totalBooks} label="Total books" />
              <StatTile value={stats.unread} label="Unread" />
            </SimpleGrid>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <SectionCard title="Up next in your series">
            {dashboard.upNextInSeries.length === 0 ? (
              <EmptyLine>
                Finish a book in a series and we will suggest the next one.
              </EmptyLine>
            ) : (
              <Stack gap="sm">
                {dashboard.upNextInSeries.map((book) => (
                  <BookRow
                    key={book.id}
                    book={book}
                    meta={
                      <Text fz="xs" c="dimmed" lineClamp={1}>
                        {book.seriesName} #{book.seriesIndex}
                      </Text>
                    }
                  />
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <SectionCard title="Recently finished">
            {dashboard.recentlyFinished.length === 0 ? (
              <EmptyLine>No finished books yet.</EmptyLine>
            ) : (
              <Stack gap="sm">
                {dashboard.recentlyFinished.map((book) => (
                  <BookRow key={book.id} book={book} />
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={12}>
          <SectionCard
            title="Picks of the day"
            aside={
              <Text fz="xs" c="dimmed">
                {now.toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            }
          >
            {dashboard.picksOfTheDay.length === 0 ? (
              <EmptyLine>
                Nothing to pick from - add some books to your libraries and
                check back tomorrow.
              </EmptyLine>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
                {dashboard.picksOfTheDay.map((book) => (
                  <BookRow key={book.id} book={book} />
                ))}
              </SimpleGrid>
            )}
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={12}>
          <SectionCard title="Recently added">
            {dashboard.recentlyAdded.length === 0 ? (
              <EmptyLine>No books yet. Add one to get started.</EmptyLine>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
                {dashboard.recentlyAdded.map((book) => (
                  <BookRow key={book.id} book={book} />
                ))}
              </SimpleGrid>
            )}
          </SectionCard>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
