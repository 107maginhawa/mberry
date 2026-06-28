import { createRootRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AppHeader, Skeleton } from '@monobase/ui'
import { useSession } from '@/features/auth/use-session'
import { signOut } from '@/features/auth/sign-in'
import { API_BASE } from '@/lib/api'

export const Route = createRootRoute({ component: RootGate })

const NAV = [
  { to: '/', label: 'Roster' },
  { to: '/import', label: 'Import' },
  { to: '/dues', label: 'Dues' },
  { to: '/events', label: 'Events' },
  { to: '/announcements', label: 'Announcements' },
  { to: '/payment-settings', label: 'Payment settings' },
] as const

const NAV_LINK = 'inline-flex min-h-tap items-center text-body font-medium text-muted-foreground hover:text-foreground'

// One primary nav for every authed officer screen (current-location via activeProps),
// replacing the per-page scattered links (DESIGN.md: consistent nav + orientation).
function OfficerNav() {
  return (
    <>
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={item.to === '/' ? { exact: true } : undefined}
          className={NAV_LINK}
          activeProps={{ className: `${NAV_LINK} !text-foreground font-semibold underline underline-offset-4` }}
        >
          {item.label}
        </Link>
      ))}
    </>
  )
}

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
        <AppHeader title="Memberry Officer" nav={<OfficerNav />} onSignOut={onSignOut} signingOut={signingOut} />
        <Outlet />
      </>
    )
  }

  // Otherwise show the spinner — never render a protected route (and fire its
  // 401/403 queries) for an unauthed user even for a single frame before the
  // redirect effect lands.
  return (
    <div role="status" aria-label="Loading" className="min-h-screen flex items-center justify-center p-4">
      <Skeleton className="h-12 w-48" />
    </div>
  )
}
