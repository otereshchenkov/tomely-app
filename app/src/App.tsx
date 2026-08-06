import { MantineProvider } from '@mantine/core'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'

import { theme } from './theme'

import '@mantine/core/styles.css'
import './styles.css'

/**
 * The application shell: every provider the app needs, in one place.
 *
 * `routes/__root.tsx` stays pure document scaffolding (<html>, <head>, script
 * tags) and renders this around the router outlet.
 */
export function App({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      {children}
      <TanStackDevtools
        config={{ position: 'bottom-right' }}
        plugins={[
          { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> },
          { name: 'TanStack Query', render: <ReactQueryDevtoolsPanel /> },
        ]}
      />
    </MantineProvider>
  )
}
