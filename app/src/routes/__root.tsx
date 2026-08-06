import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'

import { App } from '../App'

import type { QueryClient } from '@tanstack/react-query'

interface RouterContext {
  queryClient: QueryClient
}

const SITE_NAME = 'Tomely'
const SITE_DESCRIPTION = 'A home library, catalogued.'

export const Route = createRootRouteWithContext<RouterContext>()({
  // Site-wide defaults. Routes that are shared as links - a book, a shelf, an
  // author - override title/og:* in their own head() so the preview a friend
  // sees in a chat app is about that page, not about the site.
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: SITE_NAME },
      { name: 'description', content: SITE_DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: SITE_NAME },
      { property: 'og:description', content: SITE_DESCRIPTION },
      { property: 'og:image', content: '/android-chrome-512x512.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico' },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32-dark.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16-dark.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      { rel: 'manifest', href: '/manifest.json' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <HeadContent />
      </head>
      <body>
        <App>{children}</App>
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  return (
    <main style={{ padding: '3rem', textAlign: 'center' }}>
      <h1>Not found</h1>
      <p>There is nothing at this address.</p>
    </main>
  )
}
