import { useQuery } from '@tanstack/react-query'
import { listOrganizations } from '@monobase/sdk-ts/generated'

export type OrgRow = {
  id: string
  name: string
  region: string | null
  orgType: string
  status: string
  createdAt: Date | string
}

export function useOrgs(): { status: 'loading' | 'ready' | 'error'; orgs: OrgRow[]; total: number } {
  const q = useQuery({
    queryKey: ['orgs'],
    retry: false,
    queryFn: async () => {
      const { data } = await listOrganizations({ query: { limit: 100 } })
      if (!data) throw new Error('orgs failed')
      // DRIFT: pagination is {offset,limit,total} at runtime; SDK type declares totalCount → cast.
      const d = data as unknown as { data: OrgRow[]; pagination: { total: number } }
      return { orgs: d.data, total: d.pagination?.total ?? d.data.length }
    },
  })
  if (q.isLoading) return { status: 'loading', orgs: [], total: 0 }
  if (q.isError || !q.data) return { status: 'error', orgs: [], total: 0 }
  return { status: 'ready', orgs: q.data.orgs, total: q.data.total }
}
