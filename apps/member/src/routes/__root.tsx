import { createRootRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AppHeader } from '@monobase/ui'
import { useSession } from '@/features/auth/use-session'
import { signOut } from '@/features/auth/sign-in'
import { API_BASE } from '@/lib/api'

export const Route = createRootRoute({ component: RootGate })

export function RootGate() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isPublic = pathname === '/sign-in' || pathname.startsWith('/pay/')
  const { status } = useSession(!isPublic) // [review m7] no probe on public /pay/* + /sign-in
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (status === 'unauthed' && !isPublic) navigate({ to: '/sign-in' })
  }, [status, isPublic, navigate])

  async function onSignOut() {
    if (signingOut) return
    setSigningOut(true)
    await signOut(API_BASE)
    await qc.invalidateQueries({ queryKey: ['session'] })
    navigate({ to: '/sign-in' })
  }

  // Public paths render bare: /sign-in and the login-free pay-link have no chrome.
  if (isPublic) return <Outlet />

  // Authed: wrap in shared chrome so every member screen has orientation + the
  // emergency-exit sign-out (Nielsen #3) — was previously only a footer button on
  // /dashboard, missing entirely from /card.
  if (status === 'authed') {
    return (
      <>
        <AppHeader title="Memberry" onSignOut={onSignOut} signingOut={signingOut} />
        <Outlet />
      </>
    )
  }

  // Otherwise show the spinner — never render a protected route (and fire its
  // 401/403 queries) for an unauthed user even for a single frame before the
  // redirect effect lands.
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
