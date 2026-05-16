import { createFileRoute } from '@tanstack/react-router'
import { MemberElectionDetail } from '@/features/elections/components/member-election-detail'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/org/$orgId/elections/$electionId/')({
  component: MemberElectionDetailPage,
})

function MemberElectionDetailPage() {
  const { orgId, electionId } = Route.useParams()
  const { user } = Route.useRouteContext() as { user?: { id: string } }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Election"
        breadcrumbs={[
          { label: 'Organization' },
          { label: 'Elections', href: `/org/${orgId}/elections` },
          { label: 'Details' },
        ]}
      />

      <GlassCard className="p-6">
        <MemberElectionDetail electionId={electionId} orgId={orgId} userId={user?.id} />
      </GlassCard>
    </div>
  )
}
