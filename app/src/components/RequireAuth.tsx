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
 *
 * `isInstanceAdmin` narrows that to the admin section. It is a second gate, not
 * a replacement for the first: an anonymous caller is still sent to /login to
 * become somebody, and only a signed-in non-admin is turned away.
 */
export function RequireAuth({
  isInstanceAdmin = false,
  children,
}: Readonly<{ isInstanceAdmin?: boolean; children: ReactNode }>) {
  const { status, user } = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // This component stays mounted through the transition to /login, so without a
  // latch the effect fires a second time - by then `pathname` is already
  // "/login" and it overwrites the redirect with a pointless `?redirect=/login`.
  const sentAway = useRef(false)

  // Nothing to admit them to and nowhere to send them until the session has
  // resolved, so both decisions wait for it.
  const anonymous = status === 'anonymous'
  const refused =
    status === 'authenticated' &&
    isInstanceAdmin &&
    user?.isInstanceAdmin !== true

  useEffect(() => {
    if (sentAway.current) return

    if (anonymous) {
      sentAway.current = true
      // `replace`, so the back button does not land on a page that will only
      // bounce here again.
      void navigate({
        to: '/login',
        search: { redirect: pathname },
        replace: true,
      })
      return
    }

    if (refused) {
      sentAway.current = true
      // No `redirect` here: signing in again would land them right back on a
      // page they are still not allowed to see.
      void navigate({ to: '/dashboard', replace: true })
    }
  }, [anonymous, refused, navigate, pathname])

  // The loader covers both the wait and the redirect. Rendering `children` while
  // the navigation is in flight would show a non-admin the admin page for a
  // frame, which is the whole thing this is here to prevent.
  if (status !== 'authenticated' || refused) {
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    )
  }

  return <>{children}</>
}
