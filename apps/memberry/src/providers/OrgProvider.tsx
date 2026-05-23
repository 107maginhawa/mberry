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

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getOrganizationBySlugOptions } from '@monobase/sdk-ts/generated/react-query'
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

export function OrgProvider({ children }: { children: ReactNode }) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }

  // Step 1: Resolve slug → org (cached forever — slugs immutable in Wave 0)
  const { data: org, isLoading: orgLoading } = useQuery({
    ...getOrganizationBySlugOptions({ path: { slug: orgSlug } }),
    staleTime: Infinity,
    enabled: !!orgSlug,
  })

  const orgId = org?.id ?? ''

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

  // Don't render children until org is resolved — prevents invalid API calls with empty orgId
  if (isLoading && !orgId) {
    return null
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
