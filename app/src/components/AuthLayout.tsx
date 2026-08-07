import { Box, Card, Center, Stack, Text, Title } from '@mantine/core'

import { Mark } from './Mark'

import type { ReactNode } from 'react'

/**
 * The centred, card-on-a-plain-background shape shared by the pages you see
 * before you are inside the app: setup and sign-in.
 */
export function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: Readonly<{
  title: string
  subtitle: string
  footer?: ReactNode
  children: ReactNode
}>) {
  return (
    <Center mih="100vh" px="md" py="xl">
      <Stack gap="lg" w="100%" maw={480}>
        <Stack gap="xs" align="center">
          {/*
            The mark sits in about the middle three fifths of its own box, so a
            120px box draws it at roughly 75px; the negative margin takes back
            the transparent strip above and below it.
          */}
          <Box my={-18}>
            <Mark size={120} />
          </Box>
          <Title order={1} ta="center">
            {title}
          </Title>
          <Text c="dimmed" ta="center">
            {subtitle}
          </Text>
        </Stack>

        <Card withBorder radius="md" padding="lg">
          {children}
        </Card>

        {footer ? (
          <Text size="sm" c="dimmed" ta="center">
            {footer}
          </Text>
        ) : null}
      </Stack>
    </Center>
  )
}
