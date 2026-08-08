import type { ReactNode } from 'react'
import { Anchor, Card, Divider, Group, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import classes from './SettingsCard.module.css'

export function SettingCard({
  title,
  icon,
  description,
  link,
}: Readonly<{
  title: string
  icon?: ReactNode
  description: ReactNode
  link: string
}>) {
  return (
    <Card withBorder radius="md" padding="lg" h="100%" className={classes.card}>
      <Anchor
        // `renderRoot` rather than `component={Link}`: Mantine's
        // polymorphic prop erases Link's generics, and with them the check
        // that `params` matches the route's `$placeholders`.
        renderRoot={(props) => <Link to={link} {...props} />}
        className={classes.link}
        underline="never"
      >
        <Group justify="left">
          {icon}
          <Text fw={500}>{title}</Text>
        </Group>
        <Divider mt={10} w={'100%'} />
        <Group
          justify="space-between"
          wrap="nowrap"
          align="flex-start"
          gap="xs"
        >
          <Text mt="sm" c="dimmed" size="sm">
            {description}
          </Text>
        </Group>
      </Anchor>
    </Card>
  )
}
