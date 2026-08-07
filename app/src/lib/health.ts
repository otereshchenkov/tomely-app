import { queryOptions } from '@tanstack/react-query'

import { apiFetch } from './api'

export interface Health {
  status: string
  database: string
  /** The API crate's version, so the footer can report both halves. */
  version: string
}

export const healthQueryKey = ['health']

/**
 * Liveness, plus the version of the API answering.
 *
 * Public and cheap, but a real round trip to Postgres on the other side, so it
 * is worth a stale time - the footer asks for it on every page.
 */
export const healthQuery = queryOptions({
  queryKey: healthQueryKey,
  queryFn: () => apiFetch<Health>('/health'),
  staleTime: 5 * 60 * 1000,
})
