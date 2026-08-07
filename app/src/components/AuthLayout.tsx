import { Card, Center, Image, Stack, Text, Title } from '@mantine/core'

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
            The source icon carries a wide transparent margin - the mark itself
            is a little under half its width - so the box has to be roughly
            double the size the logo should look, and the negative margin takes
            back the vertical space that margin would otherwise add.
          */}
          <Image
            src="/android-chrome-512x512.png"
            alt=""
            w={160}
            h={160}
            my={-38}
            fit="contain"
          />
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
