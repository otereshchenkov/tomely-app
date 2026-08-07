import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, apiFetch } from './api'
import { clearToken, getToken, setToken } from './token'

import type { ReactNode } from 'react'

export interface User {
  id: string
  displayName: string
  email: string
  isInstanceAdmin: boolean
}

export interface Session {
  token: string
  expiresAt: string
  user: User
}

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  user: User | null
  status: AuthStatus
  signIn: (session: Session, remember: boolean) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside an AuthProvider')
  return value
}

export const currentUserQueryKey = ['auth', 'me']

/**
 * Holds the signed-in user for the whole app.
 *
 * Auth lives entirely on the client. The token is read in an effect rather than
 * during render, so the server-rendered HTML is identical for everyone and the
 * markup the client first paints matches it - private routes render their shell
 * on the server and fill in once this resolves.
 */
export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient()
  // undefined means "not looked yet", which is what distinguishes the first
  // render from a genuinely signed-out one.
  const [token, setTokenState] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    setTokenState(getToken())
  }, [])

  const query = useQuery({
    queryKey: currentUserQueryKey,
    queryFn: () => apiFetch<User>('/auth/me'),
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  // A token the API will not accept - expired, or signed with a secret that has
  // since changed - is no better than no token, so drop it rather than retrying
  // it on every request.
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) {
      clearToken()
      setTokenState(null)
      queryClient.removeQueries({ queryKey: currentUserQueryKey })
    }
  }, [query.error, queryClient])

  const signIn = useCallback(
    (session: Session, remember: boolean) => {
      setToken(session.token, remember)
      setTokenState(session.token)
      // The login response already contains the user, so seed the cache instead
      // of asking /auth/me for something we were just told.
      queryClient.setQueryData(currentUserQueryKey, session.user)
    },
    [queryClient],
  )

  const signOut = useCallback(() => {
    clearToken()
    setTokenState(null)
    queryClient.removeQueries({ queryKey: currentUserQueryKey })
  }, [queryClient])

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthStatus = 'anonymous'
    if (token === undefined || (token && query.isPending)) status = 'loading'
    else if (token && query.data) status = 'authenticated'

    return {
      user: status === 'authenticated' ? (query.data ?? null) : null,
      status,
      signIn,
      signOut,
    }
  }, [token, query.isPending, query.data, signIn, signOut])

  return <AuthContext value={value}>{children}</AuthContext>
}
