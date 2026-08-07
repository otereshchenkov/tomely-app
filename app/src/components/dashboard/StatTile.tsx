import { Card, Text } from '@mantine/core'

import type { MantineColor } from '@mantine/core'

/** One number and what it counts. */
export function StatTile({
  value,
  label,
  color,
}: Readonly<{
  value: number
  label: string
  /** Left off for the neutral tiles; the two that are about *you* are tinted. */
  color?: MantineColor
}>) {
  return (
    <Card withBorder radius="md" padding="md">
      <Text fz={28} fw={700} lh={1.2} c={color}>
        {value}
      </Text>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
    </Card>
  )
}
