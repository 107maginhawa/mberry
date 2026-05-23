/**
 * useMyOrgs — shared hook for fetching the authenticated user's org memberships.
 *
 * Returns enriched membership data (org name, slug, status, role) used by
 * OrgIconRail (desktop) and OrgPickerSheet (mobile).
 *
 * Also detects the active org from the current URL pathname.
 */

import { useQuery } from '@tanstack/react-query'
import { useLocation } from '@tanstack/react-router'
import { api } from '@/lib/api'

export interface OrgMembership {
  id: string
  organizationId: string
  orgName: string
  orgSlug: string
  memberNumber?: string
  status: string
  tierId?: string
  startDate?: string
  duesExpiryDate?: string
}

export function useMyOrgs() {
  const location = useLocation()

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['my-memberships'],
    queryFn: async () => {
      const json = await api.get<any>('/api/persons/me/memberships')
      const raw = json.data || []
      return raw.map((m: any) => ({
        id: m.id,
        organizationId: m.organizationId || m.orgId,
        orgName: m.orgName || m.organizationName || '',
        orgSlug: m.orgSlug || '',
        memberNumber: m.memberNumber || m.membershipNumber,
        status: m.status || m.membershipStatus || 'active',
        tierId: m.tierId,
        startDate: m.startDate,
        duesExpiryDate: m.duesExpiryDate,
      })) as OrgMembership[]
    },
  })

  // Detect active org from URL: /org/{slug}/...
  const slugMatch = location.pathname.match(/^\/org\/([^/]+)/)
  const activeOrgSlug = slugMatch?.[1] ?? null

  return { orgs, isLoading, activeOrgSlug }
}
