import { createRootRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppHeader, BottomTabBar, bottomTabClass, NavIcon, Skeleton } from '@monobase/ui'
import { Users, Calendar, Settings } from '@monobase/ui/icons'
import { useSession } from '@/features/auth/use-session'
import { signOut } from '@/features/auth/sign-in'
import { API_BASE } from '@/lib/api'

export const Route = createRootRoute({ component: RootGate })

// People-first IA (DESIGN.md / MEMBERSHIP_MANAGEMENT_UI.md): three thumb-reachable
// tabs replace the old flat link row. Members is home (the directory + send-link
// deep links); Events its own tab; everything low-frequency lives under More
// (/import, /dues, /announcements, /payment-settings). `match` lights the right
// tab on deep routes (e.g. /members/$id/send → Members, /import → More).
const TABS = [
  { to: '/', label: 'Members', icon: Users, match: (p: string) => p === '/' || p.startsWith('/members') },
  { to: '/events', label: 'Events', icon: Calendar, match: (p: string) => p.startsWith('/events') },
  {
    to: '/more',
    label: 'More',
    icon: Settings,
    // The hub itself + every tool parked under it. Exact-or-subpath match (not a
    // bare prefix) so an unrelated route like /importers wouldn't light More.
    match: (p: string) =>
      ['/more', '/import', '/dues', '/announcements', '/payment-settings'].some(
        (r) => p === r || p.startsWith(`${r}/`),
      ),
  },
] as const

function OfficerTabs({ pathname }: { pathname: string }) {
  return (
    <BottomTabBar>
      {TABS.map((tab) => {
        const active = tab.match(pathname)
        return (
          <Link key={tab.to} to={tab.to} aria-current={active ? 'page' : undefined} className={bottomTabClass(active)}>
            <NavIcon icon={tab.icon} size="lg" aria-hidden />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </BottomTabBar>
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
    else if (status === 'authed' && pathname === '/sign-in') navigate({ to: '/' })
  }, [status, pathname, navigate])

  async function onSignOut() {
    if (signingOut) return
    setSigningOut(true)
    const res = await signOut(API_BASE)
    if (!res.ok) { toast.error(res.error); setSigningOut(false); return }
    await qc.invalidateQueries({ queryKey: ['session'] })
    navigate({ to: '/sign-in' })
  }

  // Public sign-in page renders bare (no app chrome).
  if (pathname === '/sign-in') return <Outlet />

  // Authed: shared chrome = top header (title + sign-out) and the bottom tab bar.
  // Pad the outlet by the bar's own height (min-h-tap 48 + py-2 16 = 4rem) plus
  // the device safe-area inset, so the fixed bar never covers a screen's last row.
  if (status === 'authed') {
    return (
      <>
        <AppHeader title="Memberry Officer" onSignOut={onSignOut} signingOut={signingOut} />
        <div className="pb-[calc(4rem+env(safe-area-inset-bottom))]">
          <Outlet />
        </div>
        <OfficerTabs pathname={pathname} />
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
