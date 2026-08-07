import { createFileRoute } from '@tanstack/react-router'
import { Button, Container, Group, Stack, Text, Title } from '@mantine/core'

import { RequireAuth } from '#/components/RequireAuth'
import { useAuth } from '#/lib/auth'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

/**
 * A placeholder for the real thing. What matters here for now is the shape: the
 * route renders on the server for everyone and `RequireAuth` decides, once the
 * client knows who is asking, whether to show it or send them to sign in.
 */
function Dashboard() {
  return (
    <RequireAuth>
      <Signedin />
    </RequireAuth>
  )
}

function Signedin() {
  const { user, signOut } = useAuth()

  return (
    <Container size="sm" py="xl">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={1}>Dashboard</Title>
          {/*
            Just sign out - `RequireAuth` notices and does the redirecting.
            Navigating here as well raced with it and produced a pointless
            `?redirect=/login`.
          */}
          <Button variant="default" onClick={signOut}>
            Sign out
          </Button>
        </Group>
        <Text>Signed in as {user?.displayName}.</Text>
        <Text c="dimmed" size="sm">
          Your library will appear here.
        </Text>
      </Stack>
    </Container>
  )
}
