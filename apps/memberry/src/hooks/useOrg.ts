/**
 * Slug-based org resolution hook.
 *
 * Reads `orgSlug` from URL params, resolves to full org object (including UUID)
 * via GET /public/org/:slug. Cached with staleTime: Infinity since slugs are
 * immutable in Wave 0.
 *
 * Usage:
 *   const { orgId, orgSlug, org, isLoading } = useOrg()
 *   // orgId = UUID for API calls
 *   // orgSlug = slug for navigation params
 */

import { useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getOrganizationBySlugOptions } from '@monobase/sdk-ts/generated/react-query'

export function useOrg() {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }

  const { data: org, isLoading, error } = useQuery({
    ...getOrganizationBySlugOptions({ path: { slug: orgSlug } }),
    staleTime: Infinity,
    enabled: !!orgSlug,
  })

  return {
    orgId: org?.id ?? '',
    orgSlug,
    org: org ?? null,
    isLoading,
    error,
  }
}
