import { createFileRoute, Outlet, useMatches, Link, useLocation } from "@tanstack/react-router"
import { useMemo } from "react"
import { useQueries } from "@tanstack/react-query"
import { requireAuth } from "@/utils/guards"
import { MemberSidebar } from "@/components/layout/member-sidebar"
import { MemberBottomNav } from "@/components/layout/member-bottom-nav"
import { MemberHeader } from "@/components/layout/member-header"
import { OrgIconRail } from "@/components/layout/org-icon-rail"
import { DeletionGraceBanner } from "@/components/layout/deletion-grace-banner"
import { ErrorBoundary } from "@/components/patterns/error-boundary"
import { AnimatePresence, motion } from "framer-motion"
import { useSpringTransition } from "@/components/motion/use-spring-transition"
import { useMyOrgs } from "@/hooks/use-my-orgs"
import { api } from "@/lib/api"
import { NpsProvider } from "@/features/surveys/components/nps-provider"

// oli-ui: exempt-pageshell — layout-shell route renders MemberHeader + Outlet, no page content of its own
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
  const { orgs } = useMyOrgs()

  // Parallel officer-role queries for each org — cached, N is small (1-3 orgs)
  const officerQueries = useQueries({
    queries: orgs.map((org) => ({
      queryKey: ['me-officer-role', org.organizationId],
      queryFn: () => api.get<any>(`/api/persons/me/officer-role/${org.organizationId}`),
      enabled: !!org.organizationId,
      retry: false,
      staleTime: 5 * 60_000,
    })),
  })

  const officerOrgIds = useMemo(() => {
    const set = new Set<string>()
    officerQueries.forEach((q, i) => {
      const positions = Array.isArray(q.data?.data) ? q.data.data : []
      if (positions.length > 0 && orgs[i]) set.add(orgs[i].organizationId)
    })
    return set
  }, [officerQueries, orgs])

  // Officer routes render their own shell via the officer layout route.
  // Detect if we're inside an officer route to avoid double-wrapping.
  const isOfficerRoute = matches.some((m) => m.routeId.includes("/officer"))

  // Detect if user is an officer in the currently active org (for sidebar link)
  const activeOrg = orgs.find((o) => o.orgSlug && location.pathname.startsWith(`/org/${o.orgSlug}`))
  const isOfficerForActiveOrg = activeOrg ? officerOrgIds.has(activeOrg.organizationId) : false

  if (isOfficerRoute) {
    return (
      <>
        <Outlet />
        <NpsProvider />
      </>
    )
  }

  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-[var(--radius-sm)] focus:bg-[var(--color-primary)] focus:text-white focus:text-body-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <OrgIconRail officerOrgIds={officerOrgIds} />
      <MemberSidebar userEmail={user?.email} isOfficer={isOfficerForActiveOrg} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DeletionGraceBanner />
        <MemberHeader userName={user?.name} />
        <main id="main-content" className="flex-1 overflow-auto pb-[var(--bottom-nav-height)] md:pb-0">
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
      <NpsProvider />
    </div>
  )
}
