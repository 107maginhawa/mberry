import { createRootRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSession } from '@/features/auth/use-session'

export const Route = createRootRoute({ component: RootGate })

function RootGate() {
  const { status } = useSession()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (status === 'unauthed' && pathname !== '/sign-in') navigate({ to: '/sign-in' })
  }, [status, pathname, navigate])

  // Only render the route tree when authed, or when on the public sign-in page.
  // Otherwise show the spinner — never render a protected route (and fire its
  // 401/403 queries) for an unauthed user even for a single frame before the
  // redirect effect lands.
  if (status === 'authed' || pathname === '/sign-in') return <Outlet />
  return <div role="status" aria-label="Loading" className="min-h-screen flex items-center justify-center">…</div>
}
