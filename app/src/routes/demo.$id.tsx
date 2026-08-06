import { createFileRoute } from '@tanstack/react-router'
import { Code, Container, Stack, Text, Title } from '@mantine/core'

/**
 * A stand-in for the public pages that get shared with people who have no
 * account - a book, a shelf, an author, a series.
 *
 * The point of this route is the `head()` below: it derives og:* tags from
 * loader data, so pasting the URL into a chat app produces a preview with the
 * real title rather than the generic site defaults. Crawlers do not run
 * JavaScript, so this only works because the page is rendered on the server.
 * Delete this route once a real public page follows the same shape.
 */
export const Route = createFileRoute('/demo/$id')({
  loader: ({ params }) => ({
    id: params.id,
    title: `Demo item ${params.id}`,
    description: `A server-rendered public page for ${params.id}.`,
  }),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} | Tomely` },
          { name: 'description', content: loaderData.description },
          { property: 'og:title', content: loaderData.title },
          { property: 'og:description', content: loaderData.description },
          { property: 'og:type', content: 'article' },
        ]
      : [],
  }),
  component: Demo,
})

function Demo() {
  const { id, title, description } = Route.useLoaderData()

  return (
    <Container size="sm" py="xl">
      <Stack gap="md">
        <Title order={1}>{title}</Title>
        <Text c="dimmed">{description}</Text>
        <Text size="sm">
          Route param: <Code>{id}</Code>
        </Text>
      </Stack>
    </Container>
  )
}
