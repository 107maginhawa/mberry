import { useQuery } from '@tanstack/react-query'
import { listAnnouncements } from '@monobase/sdk-ts/generated'

// View type — field names anchored to the real SDK `Announcement` (title/content,
// status enum, createdAt/publishedAt as Date|string at runtime). See types.gen.ts.
export type AnnouncementListItem = {
  id: string
  title: string
  content: string
  status: 'draft' | 'scheduled' | 'sent' | 'scheduledFailed' | 'archived'
  // publishedAt when present, else createdAt. Typed Date in the SDK, string over the wire.
  date: string | Date
}

export function useListAnnouncements(
  orgId: string | null,
): { status: 'idle' | 'loading' | 'ready' | 'empty' | 'error'; announcements: AnnouncementListItem[]; refetch: () => void } {
  const q = useQuery({
    queryKey: ['announcements', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await listAnnouncements({ path: { organizationId: orgId! }, query: {} })
      if (!data) throw new Error((error as any)?.error ?? 'announcements failed')
      // AnnouncementListResponse = { data: Announcement[], pagination }.
      const rows = data.data ?? []
      return rows.map((a): AnnouncementListItem => ({
        id: a.id,
        title: a.title,
        content: a.content,
        status: a.status,
        date: a.publishedAt ?? a.createdAt,
      }))
    },
  })
  const refetch = () => void q.refetch()
  if (!orgId) return { status: 'idle', announcements: [], refetch }
  if (q.isLoading) return { status: 'loading', announcements: [], refetch }
  if (q.isError) return { status: 'error', announcements: [], refetch }
  const announcements = q.data ?? []
  return { status: announcements.length === 0 ? 'empty' : 'ready', announcements, refetch }
}
