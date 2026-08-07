import { Card, Group, Text, Title } from '@mantine/core'

import type { ReactNode } from 'react'

/**
 * The shape every panel on the dashboard shares: a heading, something optional
 * on the right of it, and a body.
 */
export function SectionCard({
  title,
  aside,
  children,
}: Readonly<{
  title: string
  aside?: ReactNode
  children: ReactNode
}>) {
  return (
    <Card withBorder radius="md" padding="lg" h="100%">
      <Group justify="space-between" align="baseline" wrap="nowrap" mb="sm">
        <Title order={2} fz="md" fw={600}>
          {title}
        </Title>
        {aside}
      </Group>
      {children}
    </Card>
  )
}

/** The line a panel shows instead of a list, when there is nothing in it. */
export function EmptyLine({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Text c="dimmed" size="sm">
      {children}
    </Text>
  )
}
