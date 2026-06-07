import { createFileRoute } from '@tanstack/react-router'
import { VotingBallot } from '@/features/elections/components/voting-ballot'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/elections/$electionId/vote')({
  component: VotePage,
})

function VotePage() {
  const { orgId, orgSlug } = useOrg()
  const { electionId } = Route.useParams()
  const { user } = Route.useRouteContext() as { user?: { id: string } }

  return (
    <PageShell
      title="Cast Your Vote"
      breadcrumbs={[
        { label: 'Organization' },
        { label: 'Elections', href: `/org/${orgSlug}/elections` },
        { label: 'Vote' },
      ]}
    >
      <div className="space-y-6">
        <GlassCard className="p-6">
          <VotingBallot electionId={electionId} orgId={orgId} userId={user?.id} />
        </GlassCard>
      </div>
    </PageShell>
  )
}
