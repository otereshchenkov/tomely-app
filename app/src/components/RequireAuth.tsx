import { useEffect, useRef } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Center, Loader } from '@mantine/core'

import { useAuth } from '#/lib/auth'

import type { ReactNode } from 'react'

/**
 * Gate a private route on the client.
 *
 * Deliberately not a route `beforeLoad`: the token only exists in the browser,
 * so a server-side guard would have to redirect everyone to /login and let the
 * client undo it. Instead the shell renders on the server for everyone and this
 * decides once the session has resolved - which is what keeps SSR ignorant of
 * auth.
 */
export function RequireAuth({ children }: Readonly<{ children: ReactNode }>) {
  const { status } = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // This component stays mounted through the transition to /login, so without a
  // latch the effect fires a second time - by then `pathname` is already
  // "/login" and it overwrites the redirect with a pointless `?redirect=/login`.
  const sentToLogin = useRef(false)

  useEffect(() => {
    if (status !== 'anonymous' || sentToLogin.current) return

    sentToLogin.current = true
    // `replace`, so the back button does not land on a page that will only
    // bounce here again.
    void navigate({
      to: '/login',
      search: { redirect: pathname },
      replace: true,
    })
  }, [status, navigate, pathname])

  if (status !== 'authenticated') {
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    )
  }

  return <>{children}</>
}
