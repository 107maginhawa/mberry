import { useEffect } from "react"
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router"
import { requireOrgOfficer, type AuthContext, type OfficerContext } from "@/utils/guards"
import { OfficerSidebar } from "@/components/layout/officer-sidebar"
import { OfficerMobileNav } from "@/components/layout/officer-mobile-nav"
import { ErrorBoundary } from "@/components/patterns/error-boundary"

export const Route = createFileRoute("/_authenticated/org/$orgId/officer")({
  beforeLoad: requireOrgOfficer,
  component: OfficerLayout,
  pendingComponent: OfficerPendingSkeleton,
})

function OfficerPendingSkeleton() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-[220px] flex-col bg-[var(--color-surface)] border-r border-[var(--color-border)]">
        <div className="p-4 space-y-3">
          <div className="h-5 w-24 bg-[var(--color-border)] rounded animate-pulse" />
          <div className="h-4 w-16 bg-[var(--color-border)] rounded animate-pulse" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 bg-[var(--color-border)] rounded animate-pulse" />
          ))}
        </div>
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-7">
        <div className="max-w-[1200px] mx-auto space-y-4">
          <div className="h-8 w-48 bg-[var(--color-border)] rounded animate-pulse" />
          <div className="h-64 bg-[var(--color-border)] rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

function OfficerLayout() {
  const routeContext = Route.useRouteContext() as AuthContext & OfficerContext
  const user = routeContext.user
  const positions = routeContext.officerPositions || []
  const primaryRole = positions[0]?.title || "Officer"
  const location = useLocation()

  useEffect(() => {
    const segments = location.pathname.split("/").filter(Boolean)
    const last = segments[segments.length - 1] || "Dashboard"
    const pageName = last.charAt(0).toUpperCase() + last.slice(1)
    document.title = `${pageName} -- Officer | Memberry`
  }, [location.pathname])

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <OfficerMobileNav
        userName={user?.name}
        role={primaryRole}
        positions={positions}
      />
      <OfficerSidebar
        userEmail={user?.email}
        userName={user?.name}
        role={primaryRole}
        positions={positions}
      />
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto px-5 md:px-7 py-5 md:py-7">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
