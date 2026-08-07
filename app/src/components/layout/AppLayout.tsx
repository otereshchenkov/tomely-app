import {
  AppShell,
  Box,
  Burger,
  Drawer,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'

import { AppFooter } from './AppFooter'
import { AppNav, Brand } from './AppNav'

import classes from './AppLayout.module.css'

import type { ReactNode } from 'react'

/**
 * The frame every signed-in page hangs in: navigation on the left, a title bar
 * across the top of the content, and a version strip at the foot.
 *
 * It is deliberately outside `RequireAuth`, so the shell is part of the
 * server-rendered HTML and only the content inside it waits for the client to
 * work out who is asking. See CLAUDE.md - private routes render their shell on
 * the server and fill in afterwards.
 *
 * Two navigations, one set of links: `AppShell.Navbar` from `sm` up, and a
 * `Drawer` below it. Mantine's own mobile navbar is full-width, which reads as
 * a page rather than as a menu you dismiss.
 */
export function AppLayout({
  title,
  subtitle,
  actions,
  children,
}: Readonly<{
  title: ReactNode
  /** A line under the heading - a count, a section name. Outside the `<h1>` on
   *  purpose: it is context, not part of the page's name. */
  subtitle?: ReactNode
  /** Buttons for the title bar - kept on the right, next to the heading. */
  actions?: ReactNode
  children: ReactNode
}>) {
  const [opened, { toggle, close }] = useDisclosure(false)

  return (
    <AppShell
      header={{ height: { base: 56, md: 0 } }}
      navbar={{ width: 260, breakpoint: 'md', collapsed: { mobile: true } }}
      footer={{ height: 44 }}
      padding={0}
    >
      <AppShell.Header hiddenFrom="md">
        <Group h="100%" px="md" gap="sm" wrap="nowrap">
          <Burger
            opened={opened}
            onClick={toggle}
            size="sm"
            aria-label="Open navigation"
          />
          <Brand />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar visibleFrom="md">
        <Box px="md" py="md">
          <Brand />
        </Box>
        <AppNav />
      </AppShell.Navbar>

      <Drawer
        opened={opened}
        onClose={close}
        size={300}
        title={<Brand />}
        padding="md"
        classNames={{
          content: classes.drawerContent,
          body: classes.drawerBody,
        }}
      >
        <AppNav onNavigate={close} />
      </Drawer>

      <AppShell.Main className={classes.main}>
        <Box className={classes.pageHeader}>
          <Group
            px={{ base: 'md', md: 'lg' }}
            py="md"
            justify="space-between"
            wrap="nowrap"
            gap="sm"
          >
            <Stack gap={2} miw={0}>
              <Title order={1} fz="h4" lh={1.3} lineClamp={1}>
                {title}
              </Title>
              {subtitle ? (
                <Text fz="xs" c="dimmed" lh={1.3}>
                  {subtitle}
                </Text>
              ) : null}
            </Stack>
            {actions}
          </Group>
        </Box>

        <Box p={{ base: 'md', md: 'lg' }}>{children}</Box>
      </AppShell.Main>

      <AppShell.Footer>
        <AppFooter />
      </AppShell.Footer>
    </AppShell>
  )
}
