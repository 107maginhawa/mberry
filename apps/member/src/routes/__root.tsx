import { createRootRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSession } from '@/features/auth/use-session'

export const Route = createRootRoute({ component: RootGate })

export function RootGate() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isPublic = pathname === '/sign-in' || pathname.startsWith('/pay/')
  const { status } = useSession(!isPublic) // [review m7] no probe on public /pay/* + /sign-in

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (status === 'unauthed' && !isPublic) navigate({ to: '/sign-in' as any })
  }, [status, isPublic, navigate])

  // Only render the route tree when authed, or when on a public path.
  // Otherwise show the spinner — never render a protected route (and fire its
  // 401/403 queries) for an unauthed user even for a single frame before the
  // redirect effect lands.
  if (status === 'authed' || isPublic) return <Outlet />
  return (
    <div
      role="status"
      aria-label="Loading"
      className="min-h-screen flex items-center justify-center"
    >
      <span className="sr-only">Loading…</span>
    </div>
  )
}
