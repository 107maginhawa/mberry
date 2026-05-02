import { createFileRoute, Outlet } from "@tanstack/react-router"
import { requireAuth } from "@/utils/guards"
import { MemberSidebar } from "@/components/layout/member-sidebar"
import { MemberBottomNav } from "@/components/layout/member-bottom-nav"

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: requireAuth,
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext() as any

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <MemberSidebar userEmail={user?.email} />
      <main className="flex-1 overflow-auto pb-[68px] md:pb-0">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-7">
          <Outlet />
        </div>
      </main>
      <MemberBottomNav />
    </div>
  )
}
