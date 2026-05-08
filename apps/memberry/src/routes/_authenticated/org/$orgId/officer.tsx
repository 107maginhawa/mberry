import { useEffect } from "react"
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router"
import { requireOrgOfficer, type AuthContext, type OfficerContext } from "@/utils/guards"
import { OfficerSidebar } from "@/components/layout/officer-sidebar"
import { OfficerMobileNav } from "@/components/layout/officer-mobile-nav"
import { ErrorBoundary } from "@/components/patterns/error-boundary"

export const Route = createFileRoute("/_authenticated/org/$orgId/officer")({
  beforeLoad: requireOrgOfficer,
  component: OfficerLayout,
})

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
    <div className="flex flex-col md:flex-row min-h-screen bg-[var(--color-bg)]">
      <OfficerMobileNav
        userName={user?.name}
        role={primaryRole}
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
