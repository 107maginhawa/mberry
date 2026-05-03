import { createFileRoute, Outlet } from "@tanstack/react-router"
import { requireOrgOfficer } from "@/utils/guards"
import { OfficerSidebar } from "@/components/layout/officer-sidebar"

export const Route = createFileRoute("/_authenticated/org/$orgId/officer")({
  beforeLoad: requireOrgOfficer,
  component: OfficerLayout,
})

function OfficerLayout() {
  const { user } = Route.useRouteContext() as any
  const routeContext = Route.useRouteContext() as any
  const positions = routeContext.officerPositions || []
  const primaryRole = positions[0]?.title || "Officer"

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <OfficerSidebar
        userEmail={user?.email}
        userName={user?.name}
        role={primaryRole}
      />
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto px-5 md:px-7 py-5 md:py-7">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
