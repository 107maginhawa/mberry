import { createFileRoute, Outlet, useMatches, Link } from "@tanstack/react-router"
import { requireAuth } from "@/utils/guards"
import { MemberSidebar } from "@/components/layout/member-sidebar"
import { MemberBottomNav } from "@/components/layout/member-bottom-nav"
import { MemberHeader } from "@/components/layout/member-header"
import { ErrorBoundary } from "@/components/patterns/error-boundary"

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: requireAuth,
  component: AuthenticatedLayout,
  notFoundComponent: () => (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <h1 className="text-hero text-[var(--color-primary)]">404</h1>
      <p className="text-h3 text-[var(--color-text)]">Page not found</p>
      <p className="text-body-sm text-[var(--color-text-secondary)] max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/dashboard" className="mt-4 px-6 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-body-sm font-medium hover:opacity-90 transition-opacity">
        Go home
      </Link>
    </div>
  ),
})

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext()
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
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <MemberBottomNav />
    </div>
  )
}
