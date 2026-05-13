import { createFileRoute } from '@tanstack/react-router'
import { ElectionDetail } from '@/features/elections/components/election-detail'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/elections/$electionId')({
  component: ElectionDetailPage,
})

function ElectionDetailPage() {
  const { orgId, electionId } = Route.useParams()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Election Details"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Elections', href: `/org/${orgId}/officer/elections` },
          { label: 'Details' },
        ]}
      />

      <GlassCard className="p-6">
        <ElectionDetail electionId={electionId} orgId={orgId} />
      </GlassCard>
    </div>
  )
}
