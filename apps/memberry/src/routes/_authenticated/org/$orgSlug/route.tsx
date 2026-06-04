import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getOrganization } from '@monobase/sdk-ts/generated/sdk.gen'
import { OrgProvider } from '@/providers/OrgProvider'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// oli-ui: exempt-pageshell — layout-shell route wraps Outlet in OrgProvider, no page content
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
        // Re-throw redirects
        if (e instanceof Response || (e && typeof e === 'object' && 'to' in e)) throw e
        // Re-throw network errors — only swallow 404 (org not found)
        const status = (e as any)?.status ?? (e as any)?.response?.status
        if (status !== 404 && status !== 400) throw e
        // UUID not found — let route render and OrgProvider show error
      }
    }
  },
  component: OrgLayout,
})

function OrgLayout() {
  return (
    <OrgProvider>
      <Outlet />
    </OrgProvider>
  )
}
