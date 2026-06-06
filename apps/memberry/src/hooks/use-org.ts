/**
 * Slug-based org resolution hook.
 *
 * Reads from OrgProvider context (set at the $orgSlug layout route).
 * Returns { orgId, orgSlug, org, isLoading } — same shape as before
 * so all 40+ consumers remain unchanged.
 *
 * Usage:
 *   const { orgId, orgSlug, org, isLoading } = useOrg()
 *   // orgId = UUID for API calls
 *   // orgSlug = slug for navigation params
 */

import { useOrgProvider } from '@/providers/OrgProvider'

export function useOrg() {
  const ctx = useOrgProvider()

  return {
    orgId: ctx.orgId,
    orgSlug: ctx.orgSlug,
    org: ctx.org,
    isLoading: ctx.isLoading,
    error: null,
  }
}
