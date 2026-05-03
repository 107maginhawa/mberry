import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router"
import { requireAuth } from "@/utils/guards"
import { MemberSidebar } from "@/components/layout/member-sidebar"
import { MemberBottomNav } from "@/components/layout/member-bottom-nav"
import { MemberHeader } from "@/components/layout/member-header"

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: requireAuth,
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext() as any
  const matches = useMatches()

  // Officer routes render their own shell via the officer layout route.
  // Detect if we're inside an officer route to avoid double-wrapping.
  const isOfficerRoute = matches.some((m) => m.routeId.includes("/officer"))

  if (isOfficerRoute) {
    return <Outlet />
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <MemberSidebar userEmail={user?.email} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MemberHeader userName={user?.name} />
        <main className="flex-1 overflow-auto pb-[68px] md:pb-0">
          <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-7">
            <Outlet />
          </div>
        </main>
      </div>
      <MemberBottomNav />
    </div>
  )
}
