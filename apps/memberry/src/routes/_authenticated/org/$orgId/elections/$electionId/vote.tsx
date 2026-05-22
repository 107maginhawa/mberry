import { createFileRoute } from '@tanstack/react-router'
import { VotingBallot } from '@/features/elections/components/voting-ballot'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/org/$orgId/elections/$electionId/vote')({
  component: VotePage,
})

function VotePage() {
  const { orgId, electionId } = Route.useParams()
  const { user } = Route.useRouteContext() as { user?: { id: string } }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Cast Your Vote"
        breadcrumbs={[
          { label: 'Organization' },
          { label: 'Elections', href: `/org/${orgId}/elections` },
          { label: 'Vote' },
        ]}
      />

      <GlassCard className="p-6">
        <VotingBallot electionId={electionId} orgId={orgId} userId={user?.id} />
      </GlassCard>
    </div>
  )
}
