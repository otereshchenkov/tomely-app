import { queryOptions } from '@tanstack/react-query'

import { apiFetch } from './api'

export interface SetupStatus {
  initialized: boolean
}

export const setupStatusQueryKey = ['setup', 'status']

/**
 * Has this instance been claimed yet?
 *
 * "No rows in `users`" is the whole definition, so this needs no auth and is
 * safe to fetch during SSR - which is what lets the root route redirect an
 * unconfigured instance to /setup on the server, before any JavaScript runs.
 */
export const setupStatusQuery = queryOptions({
  queryKey: setupStatusQueryKey,
  queryFn: () => apiFetch<SetupStatus>('/setup/status'),
})
