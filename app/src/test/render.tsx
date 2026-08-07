import { render } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AuthProvider } from '../lib/auth'
import { theme } from '../theme'

/**
 * Render a component wrapped in the same providers the app uses (Mantine theme
 * + TanStack Query + the auth session), so components that read theme, query or
 * auth context behave as they do in the app.
 */
export function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <AuthProvider>{ui}</AuthProvider>
      </MantineProvider>
    </QueryClientProvider>,
  )
}
