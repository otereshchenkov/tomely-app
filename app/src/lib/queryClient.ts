import { QueryClient } from '@tanstack/react-query'

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data fetched during SSR is handed to the client through the router's
        // SSR-query integration; without a non-zero staleTime the client would
        // immediately refetch everything it was just given.
        staleTime: 60 * 1000,
      },
    },
  })

  return { queryClient }
}
