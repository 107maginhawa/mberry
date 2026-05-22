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
      <div className="hidden md:flex w-[64px] lg:w-[240px] flex-col bg-[var(--color-primary)] shrink-0 transition-[width] duration-200">
        <div className="p-3 lg:p-4 space-y-3">
          <div className="h-8 w-8 lg:h-5 lg:w-24 bg-white/10 rounded animate-pulse mx-auto lg:mx-0" />
        </div>
        <div className="flex-1 p-2 lg:p-3 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 bg-white/10 rounded animate-pulse" />
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-[var(--radius-sm)] focus:bg-[var(--color-primary)] focus:text-white focus:text-body-sm focus:font-medium"
      >
        Skip to main content
      </a>
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
      <main id="main-content" className="flex-1 overflow-auto flex flex-col">
        <div className="max-w-[1200px] mx-auto px-5 md:px-7 py-5 md:py-7 flex-1 w-full">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
        <div className="mt-auto pointer-events-none select-none" style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 40%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 40%)' }}>
          <img src="/memberry-bg.png" alt="" className="w-full opacity-30" />
        </div>
      </main>
    </div>
  )
}
