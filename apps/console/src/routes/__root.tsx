import { createRootRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Card } from '@monobase/ui'
import { useSession } from '@/features/auth/use-session'

export const Route = createRootRoute({ component: RootGate })

export function RootGate() {
  const { status } = useSession()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    // /sign-in route is added in a later task; cast until the route is registered.
    if (status === 'unauthed' && pathname !== '/sign-in') navigate({ to: '/sign-in' as any })
  }, [status, pathname, navigate])

  if (status === 'forbidden') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-6 space-y-2">
          <h1 className="text-section font-semibold text-foreground">Platform operator access required</h1>
          <p role="alert" className="text-body text-foreground">
            Your account is signed in but is not a platform operator. Contact the Memberry team if you
            believe this is an error.
          </p>
        </Card>
      </div>
    )
  }

  // Only render the route tree when authed, or when on the public sign-in page.
  // Otherwise show the spinner — never render a protected route (and fire its
  // 401/403 queries) for an unauthed user even for a single frame before the
  // redirect effect lands.
  if (status === 'authed' || pathname === '/sign-in') return <Outlet />
  return (
    <div role="status" aria-label="Loading" className="min-h-screen flex items-center justify-center">
      …
    </div>
  )
}
