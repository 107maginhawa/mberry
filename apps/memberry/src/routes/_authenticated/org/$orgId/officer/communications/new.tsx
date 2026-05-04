import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ComposeForm } from '@/features/communications/components/compose-form'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/communications/new')({
  validateSearch: (search: Record<string, unknown>) => ({
    edit: (search.edit as string) || undefined,
  }),
  component: NewAnnouncementPage,
})

function NewAnnouncementPage() {
  const { orgId } = Route.useParams()
  const { edit } = Route.useSearch()

  const { data: draft } = useQuery({
    queryKey: ['announcement-draft', edit],
    enabled: !!edit,
    queryFn: () => api.get<{ data: any }>(`/api/communications/announcements/detail/${edit}`),
  })

  const existingAnnouncement = draft?.data ? {
    id: draft.data.id,
    title: draft.data.title,
    content: draft.data.content,
    audienceType: draft.data.audienceType ?? 'all',
    audienceCategories: draft.data.audienceCategories,
    channelPush: draft.data.channelPush ?? true,
    channelEmail: draft.data.channelEmail ?? false,
    visibility: draft.data.visibility ?? 'internal',
    scheduledAt: draft.data.scheduledAt,
  } : undefined

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link
          to="/org/$orgId/officer/communications"
          params={{ orgId }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Communications
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">{edit ? 'Edit Announcement' : 'New Announcement'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {edit ? 'Update your draft announcement' : 'Compose and send a message to your members'}
        </p>
      </div>
      <ComposeForm orgId={orgId} existingAnnouncement={existingAnnouncement} />
    </div>
  )
}
