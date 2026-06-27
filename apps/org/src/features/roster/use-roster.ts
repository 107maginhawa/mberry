import { useQuery } from '@tanstack/react-query'
import { listOrgMembers } from '@monobase/sdk-ts/generated'

export type RosterMember = {
  membershipId: string
  personId: string
  name: string
  memberNumber?: string
  status: string
}

export function useRoster(
  orgId: string | null,
): { status: 'idle' | 'loading' | 'ready' | 'empty'; members: RosterMember[] } {
  const q = useQuery({
    queryKey: ['roster', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data } = await listOrgMembers({ path: { organizationId: orgId! } })
      if (!data) throw new Error('roster failed')
      return (
        data.data as Array<{
          id: string
          personId: string
          firstName?: string | null
          lastName?: string | null
          status: string
          memberNumber?: string
        }>
      ).map((m) => ({
        membershipId: m.id,
        personId: m.personId,
        name: [m.firstName, m.lastName].filter(Boolean).join(' ') || '(no name)',
        memberNumber: m.memberNumber,
        status: m.status,
      }))
    },
  })
  if (!orgId) return { status: 'idle', members: [] }
  if (q.isLoading) return { status: 'loading', members: [] }
  const members = q.data ?? []
  return { status: members.length === 0 ? 'empty' : 'ready', members }
}
