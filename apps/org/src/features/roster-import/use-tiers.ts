// apps/org/src/features/roster-import/use-tiers.ts
import { useQuery } from '@tanstack/react-query'
import { listMembershipTiers } from '@monobase/sdk-ts/generated'

export type Tier = { id: string; name: string; code: string }

export function useTiers(orgId: string | null): { tiers: Tier[]; loading: boolean } {
  const q = useQuery({
    queryKey: ['tiers', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      // listMembershipTiers returns a NESTED body: { data: tiers[], pagination }.
      const { data } = await listMembershipTiers()
      if (!data) throw new Error('tiers failed')
      return (data.data as Array<{ id: string; name: string; code: string }>).map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
      }))
    },
  })
  return { tiers: q.data ?? [], loading: !!orgId && q.isLoading }
}
