import { createFileRoute } from '@tanstack/react-router'
import { AffiliationList } from '@/features/chapters/components/affiliation-list'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/settings/chapters')({
  component: ChaptersSettingsPage,
})

function ChaptersSettingsPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chapter Affiliations"
        subtitle="Manage chapter relationships"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Settings' },
          { label: 'Chapters' },
        ]}
      />
      <GlassCard className="p-6">
        <AffiliationList orgId={orgId} tenantId={orgId} />
      </GlassCard>
    </div>
  )
}
