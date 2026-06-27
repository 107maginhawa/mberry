import { useQuery } from '@tanstack/react-query'
import { listAssociations } from '@monobase/sdk-ts/generated'

export type AssocRow = { id: string; name: string }

export function useAssociations(): { status: 'loading' | 'ready' | 'error'; associations: AssocRow[] } {
  const q = useQuery({
    queryKey: ['associations'],
    retry: false,
    queryFn: async () => {
      const { data } = await listAssociations({ query: { limit: 100 } })
      if (!data) throw new Error('associations failed')
      // DRIFT: pagination is {offset,limit,total} at runtime; SDK type declares count → cast.
      const d = data as unknown as { data: Array<{ id: string; name: string }> }
      return { associations: d.data.map(a => ({ id: a.id, name: a.name })) }
    },
  })
  if (q.isLoading) return { status: 'loading', associations: [] }
  if (q.isError || !q.data) return { status: 'error', associations: [] }
  return { status: 'ready', associations: q.data.associations }
}
