import { Alert, Code, Container, Stack, Text } from '@mantine/core'

/**
 * Shown when a route could not reach the API at all.
 *
 * The root route fetches the setup status before anything renders, so this is
 * also what a visitor sees when the API is down - better than a blank page with
 * no hint about which half of the stack is missing.
 */
export function ApiUnreachable({ error }: Readonly<{ error: Error }>) {
  return (
    <Container size="sm" py="xl">
      <Alert color="red" title="Cannot reach the API">
        <Stack gap="xs">
          <Text size="sm">{error.message}</Text>
          <Text size="sm" c="dimmed">
            Start it with <Code>docker compose up -d</Code> and{' '}
            <Code>cargo run</Code> from the repository root.
          </Text>
        </Stack>
      </Alert>
    </Container>
  )
}
