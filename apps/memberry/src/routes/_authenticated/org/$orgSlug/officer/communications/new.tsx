import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ComposeForm } from '@/features/communications/components/compose-form'
import { api } from '@/lib/api'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/communications/new')({
  validateSearch: (search: Record<string, unknown>) => ({
    edit: (search.edit as string) || undefined,
  }),
  component: NewAnnouncementPage,
})

function NewAnnouncementPage() {
  const { orgId, orgSlug } = useOrg()
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
    <PageShell
      title={edit ? 'Edit Announcement' : 'New Announcement'}
      subtitle={edit ? 'Update your draft announcement' : 'Compose and send a message to your members'}
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Communications', href: `/org/${orgSlug}/officer/communications` },
        { label: edit ? 'Edit' : 'New' },
      ]}
    >
      <GlassCard className="p-6">
        <ComposeForm orgId={orgId} existingAnnouncement={existingAnnouncement} />
      </GlassCard>
    </PageShell>
  )
}
