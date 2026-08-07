import { createFileRoute } from '@tanstack/react-router'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { Anchor, Code, Container, Stack, Text, Title } from '@mantine/core'

import { ApiUnreachable } from '../components/ApiUnreachable'
import { apiFetch } from '../lib/api'

interface Health {
  status: string
  database: string
}

const healthQuery = queryOptions({
  queryKey: ['health'],
  queryFn: () => apiFetch<Health>('/health'),
})

export const Route = createFileRoute('/')({
  // Runs on the server for the initial request, so the payload below is in the
  // HTML before any JavaScript executes. That is the whole point of rendering
  // this app server-side rather than as a static SPA.
  loader: ({ context }) => context.queryClient.ensureQueryData(healthQuery),
  component: Home,
  errorComponent: ApiUnreachable,
})

function Home() {
  const { data } = useSuspenseQuery(healthQuery)

  return (
    <Container size="sm" py="xl">
      <Stack gap="md">
        <Title order={1}>Tomely</Title>
        <Text c="dimmed">A home library, catalogued.</Text>
        <Text>
          API health: <Code>{JSON.stringify(data)}</Code>
        </Text>
        <Text size="sm" c="dimmed">
          Server-rendered link previews are demonstrated at{' '}
          <Anchor href="/demo/hello">/demo/hello</Anchor>.
        </Text>
      </Stack>
    </Container>
  )
}
