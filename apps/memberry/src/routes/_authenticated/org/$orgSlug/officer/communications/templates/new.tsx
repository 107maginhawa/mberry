import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { TemplateForm } from '@/features/communications/components/template-form'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute(
  '/_authenticated/org/$orgSlug/officer/communications/templates/new',
)({
  validateSearch: (search: Record<string, unknown>) => ({
    edit: (search.edit as string) || undefined,
  }),
  component: NewTemplatePage,
})

function NewTemplatePage() {
  const { orgId, orgSlug } = useOrg()
  const { edit } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: existing } = useQuery({
    queryKey: ['template-detail', edit],
    enabled: !!edit,
    queryFn: () =>
      api.get<{
        data: {
          id: string
          name: string
          channel: string
          category: string
          subject?: string
          body: string
          mergeFields?: string[]
          status: string
        }
      }>(`/api/communications/templates/${edit}`),
  })

  const existingTemplate = existing?.data
    ? {
        id: existing.data.id,
        name: existing.data.name,
        channel: existing.data.channel,
        category: existing.data.category,
        subject: existing.data.subject,
        body: existing.data.body,
        mergeFields: existing.data.mergeFields,
        status: existing.data.status,
      }
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title={edit ? 'Edit Template' : 'New Template'}
        subtitle={
          edit
            ? 'Update your message template'
            : 'Create a reusable message template with merge fields'
        }
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Communications', href: `/org/${orgSlug}/officer/communications` },
          {
            label: 'Templates',
            href: `/org/${orgSlug}/officer/communications/templates`,
          },
          { label: edit ? 'Edit' : 'New' },
        ]}
      />
      <GlassCard className="p-6">
        <TemplateForm
          orgId={orgId}
          existingTemplate={existingTemplate}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['templates', orgId] })
            navigate({
              to: `/org/${orgSlug}/officer/communications/templates`,
            })
          }}
        />
      </GlassCard>
    </div>
  )
}
