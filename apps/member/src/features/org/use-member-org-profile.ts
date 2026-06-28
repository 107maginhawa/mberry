import { useQuery } from '@tanstack/react-query'
import { getOrganizationProfile } from '@monobase/sdk-ts/generated'
import { useMemberOrg } from './use-member-org'

/**
 * Member-facing org contact info, for the "contact your chapter" affordance.
 *
 * GET /association/member/org-profile/{organizationId} (bearer). Returns the
 * OrganizationProfile — we only need name + contact channels here. Bound to a
 * narrow handler-anchored shape (SDK types drift from frozen handlers).
 */
export type OrgContact = {
  name: string
  contactEmail: string | null
  phone: string | null
  website: string | null
}

export function useMemberOrgProfile() {
  const { orgId } = useMemberOrg()
  return useQuery<OrgContact>({
    queryKey: ['org-profile', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { data, response } = await getOrganizationProfile({ path: { organizationId: orgId! } })
      if (!response || !response.ok) throw new Error(`Org profile fetch failed: ${response?.status ?? 'no response'}`)
      if (!data) throw new Error('No org profile returned')
      const d = data as Record<string, unknown>
      return {
        name: (d.name as string) ?? 'Your chapter',
        contactEmail: (d.contactEmail as string) ?? null,
        phone: (d.phone as string) ?? null,
        website: (d.website as string) ?? null,
      }
    },
  })
}
