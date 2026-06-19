/**
 * OrgProvider — centralized org context for all /org/$orgSlug/* routes.
 *
 * Fetches org (slug→UUID) and officer role in a single provider.
 * All child routes access org data via useOrgProvider() instead of
 * making their own queries.
 *
 * Data flow:
 *   1. Resolve slug → PublicOrganization (staleTime: Infinity, immutable in Wave 0)
 *   2. With orgId, fetch officer role → { isOfficer, positions }
 *   3. Expose { org, orgId, orgSlug, role, permissions, isOfficer } via context
 */

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getOrganizationBySlugOptions } from '@monobase/sdk-ts/generated/react-query'
import { setSdkOrgId } from '@monobase/sdk-ts/client'
import { api } from '@/lib/api'
import type { PublicOrganization, OfficerPosition } from '@monobase/sdk-ts/generated/types.gen'

export type OrgRole = 'officer' | 'member' | null

export interface OrgContextValue {
  /** Full org object from slug resolution */
  org: PublicOrganization | null
  /** Org UUID for API calls */
  orgId: string
  /** URL slug from route params */
  orgSlug: string
  /** Derived role: 'officer' | 'member' | null */
  role: OrgRole
  /** Active officer positions (empty if not officer) */
  permissions: OfficerPosition[]
  /** Whether user holds active officer position in this org */
  isOfficer: boolean
  /** True while org or officer data still loading */
  isLoading: boolean
}

const OrgContext = createContext<OrgContextValue | null>(null)

// Post slug-migration, /org/:orgSlug URLs carry the org UUID directly (see the
// matching back-compat path in apps/memberry/src/utils/guards.ts). The public
// slug→org lookup 404s for a UUID, which previously left orgId empty and broke
// every child API call (events 403 / announcements 404 with `organizationId=`).
const ORG_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function OrgProvider({ children }: { children: ReactNode }) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const slugIsUuid = ORG_UUID_RE.test(orgSlug ?? '')

  // Step 1: Resolve slug → org (cached forever — slugs immutable in Wave 0).
  // Skipped when the param is already a UUID, since /public/org/:slug 404s for one.
  const { data: org, isLoading: orgLoading } = useQuery({
    ...getOrganizationBySlugOptions({ path: { slug: orgSlug } }),
    staleTime: Infinity,
    enabled: !!orgSlug && !slugIsUuid,
  })

  // Prefer the resolved org UUID; fall back to a UUID route param directly.
  const orgId = org?.id ?? (slugIsUuid ? orgSlug : '')

  // Publish the active org so the SDK client + api lib inject x-org-id on
  // org-scoped requests. Set during render (before child queries fire) and
  // cleared on unmount (leaving /org/* surfaces).
  setSdkOrgId(orgId || null)
  useEffect(() => () => setSdkOrgId(null), [])

  // Step 2: Fetch officer role (needs orgId from step 1)
  const { data: officerData, isLoading: officerLoading } = useQuery({
    queryKey: ['me-officer-role', orgId],
    queryFn: () =>
      api.get<{ data: { isOfficer: boolean; positions: OfficerPosition[] } }>(
        `/api/persons/me/officer-role/${orgId}`,
      ),
    enabled: !!orgId,
  })

  const isOfficer = officerData?.data?.isOfficer ?? false
  const permissions = officerData?.data?.positions ?? []
  const role: OrgRole = isOfficer ? 'officer' : orgId ? 'member' : null
  const isLoading = orgLoading || (!!orgId && officerLoading)

  const value = useMemo<OrgContextValue>(
    () => ({
      org: org ?? null,
      orgId,
      orgSlug,
      role,
      permissions,
      isOfficer,
      isLoading,
    }),
    [org, orgId, orgSlug, role, permissions, isOfficer, isLoading],
  )

  // Show loading skeleton until org is resolved — prevents invalid API calls with empty orgId
  if (isLoading && !orgId) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="animate-spin h-6 w-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <OrgContext.Provider value={value}>
      {children}
    </OrgContext.Provider>
  )
}

/**
 * Access org context. Must be called within an OrgProvider (i.e., under /org/$orgSlug/* routes).
 * Throws if used outside provider — use useOrgProviderOptional() for conditional access.
 */
export function useOrgProvider(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) {
    throw new Error('useOrgProvider must be used within <OrgProvider> (under /org/$orgSlug/* routes)')
  }
  return ctx
}

/**
 * Optional access — returns null outside OrgProvider.
 * Useful for components that render on both /org/ and /my/ routes.
 */
export function useOrgProviderOptional(): OrgContextValue | null {
  return useContext(OrgContext)
}
