import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getOrganization } from '@monobase/sdk-ts/generated/sdk.gen'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const Route = createFileRoute('/_authenticated/org/$orgSlug')({
  beforeLoad: async ({ params, location }) => {
    // UUID in URL → resolve to slug and 301 redirect
    if (UUID_RE.test(params.orgSlug)) {
      try {
        const { data } = await getOrganization({
          path: { organizationId: params.orgSlug },
        })
        const org = data as Record<string, unknown> | undefined
        if (org?.slug && typeof org.slug === 'string') {
          throw redirect({
            to: location.pathname.replace(params.orgSlug, org.slug) as '/',
            replace: true,
          })
        }
      } catch (e) {
        // If it's a redirect, re-throw it
        if (e instanceof Response || (e && typeof e === 'object' && 'to' in e)) throw e
        // UUID not found — let route render and show 404
      }
    }
  },
  component: OrgLayout,
})

function OrgLayout() {
  return <Outlet />
}
