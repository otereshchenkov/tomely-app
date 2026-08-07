/**
 * The API is reachable at two different addresses because the app renders on
 * both sides of the wire:
 *
 * - On the server (SSR, route loaders) it is a direct host-to-host call, so it
 *   needs an absolute URL and reads a *runtime* env var. In containers that is
 *   the compose service name, e.g. http://api:8080.
 * - In the browser it is a same-origin `/api` path in dev (proxied by Vite) or
 *   the API's public origin in production, baked in at build time as VITE_API_URL.
 */
import { getToken } from './token'

function baseUrl(): string {
  if (import.meta.env.SSR) {
    return process.env.API_INTERNAL_URL ?? 'http://localhost:8080'
  }
  return import.meta.env.VITE_API_URL ?? '/api'
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  // Only ever present in the browser - `getToken` returns null under SSR - so
  // server-rendered requests are anonymous whether or not the caller thought
  // about it. What a 401 means is the auth layer's business, not this one's.
  const token = getToken()

  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    // The axum side answers with { error, message }; fall back to the status
    // line when the body is empty or not JSON (a proxy error, say).
    const body = await response.text()
    let message = body || response.statusText
    try {
      const parsed = JSON.parse(body) as { message?: string }
      if (parsed.message) message = parsed.message
    } catch {
      // keep the raw body
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
