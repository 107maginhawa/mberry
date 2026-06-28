import { createRootRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AppHeader } from '@monobase/ui'
import { useSession } from '@/features/auth/use-session'
import { signOut } from '@/features/auth/sign-in'
import { API_BASE } from '@/lib/api'

export const Route = createRootRoute({ component: RootGate })

function RootGate() {
  const { status } = useSession()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (status === 'unauthed' && pathname !== '/sign-in') navigate({ to: '/sign-in' })
  }, [status, pathname, navigate])

  async function onSignOut() {
    if (signingOut) return
    setSigningOut(true)
    await signOut(API_BASE)
    await qc.invalidateQueries({ queryKey: ['session'] })
    navigate({ to: '/sign-in' })
  }

  // Public sign-in page renders bare (no app chrome).
  if (pathname === '/sign-in') return <Outlet />

  // Authed: wrap the route tree in shared chrome (orientation + sign-out).
  if (status === 'authed') {
    return (
      <>
        <AppHeader title="Memberry Officer" onSignOut={onSignOut} signingOut={signingOut} />
        <Outlet />
      </>
    )
  }

  // Otherwise show the spinner — never render a protected route (and fire its
  // 401/403 queries) for an unauthed user even for a single frame before the
  // redirect effect lands.
  return <div role="status" aria-label="Loading" className="min-h-screen flex items-center justify-center">…</div>
}
