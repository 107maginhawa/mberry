import { createFileRoute, Outlet, useMatches, Link, useLocation } from "@tanstack/react-router"
import { requireAuth } from "@/utils/guards"
import { MemberSidebar } from "@/components/layout/member-sidebar"
import { MemberBottomNav } from "@/components/layout/member-bottom-nav"
import { MemberHeader } from "@/components/layout/member-header"
import { ErrorBoundary } from "@/components/patterns/error-boundary"
import { AnimatePresence, motion } from "framer-motion"
import { useSpringTransition } from "@/components/motion/use-spring-transition"

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
  const location = useLocation()
  const springProps = useSpringTransition()

  // Officer routes render their own shell via the officer layout route.
  // Detect if we're inside an officer route to avoid double-wrapping.
  const isOfficerRoute = matches.some((m) => m.routeId.includes("/officer"))

  if (isOfficerRoute) {
    return <Outlet />
  }

  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-[var(--radius-sm)] focus:bg-[var(--color-primary)] focus:text-white focus:text-body-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <MemberSidebar userEmail={user?.email} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MemberHeader userName={user?.name} />
        <main id="main-content" className="flex-1 overflow-auto pb-[68px] md:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              {...springProps}
            >
              <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-7">
                <ErrorBoundary>
                  <Outlet />
                </ErrorBoundary>
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <MemberBottomNav />
    </div>
  )
}
