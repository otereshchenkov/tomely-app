import { useQuery } from '@tanstack/react-query'
import { Anchor, Group, Text } from '@mantine/core'

import { healthQuery } from '#/lib/health'

const REPO_URL = 'https://github.com/otereshchenkov/tomely-app'

/**
 * The strip along the bottom: which versions are running, and where to go with
 * a problem.
 *
 * The API's version comes from /health with a plain `useQuery` rather than a
 * route loader, so a version line is never something SSR has to wait for - and
 * an API that is down costs the page nothing but a missing number.
 */
export function AppFooter() {
  const { data } = useQuery({ ...healthQuery, retry: false })
  const webVersion = import.meta.env.VITE_APP_VERSION

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap" gap="sm">
      <Group gap="md" wrap="nowrap">
        <Text fz="xs" fw={600}>
          Tomely
        </Text>
        {webVersion ? (
          <Text fz="xs" c="dimmed" visibleFrom="xs">
            Web: v{webVersion}
          </Text>
        ) : null}
        {data?.version ? (
          <Text fz="xs" c="dimmed" visibleFrom="xs">
            API: v{data.version}
          </Text>
        ) : null}
      </Group>

      <Group gap="md" wrap="nowrap">
        <FooterLink href={REPO_URL}>Source</FooterLink>
        <FooterLink href={`${REPO_URL}/blob/main/LICENSE`}>License</FooterLink>
        <FooterLink href={`${REPO_URL}/issues/new`}>Report an issue</FooterLink>
      </Group>
    </Group>
  )
}

function FooterLink({
  href,
  children,
}: Readonly<{ href: string; children: string }>) {
  return (
    <Anchor
      href={href}
      target="_blank"
      rel="noreferrer"
      fz="xs"
      c="dimmed"
      underline="hover"
      style={{ whiteSpace: 'nowrap' }}
    >
      {children}
    </Anchor>
  )
}
