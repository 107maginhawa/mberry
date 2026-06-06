import { createFileRoute } from '@tanstack/react-router'
import { MemberElectionDetail } from '@/features/elections/components/member-election-detail'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/elections/$electionId/')({
  component: MemberElectionDetailPage,
})

function MemberElectionDetailPage() {
  const { orgId, orgSlug } = useOrg()
  const { electionId } = Route.useParams()
  const { user } = Route.useRouteContext() as { user?: { id: string } }

  return (
    <PageShell
      title="Election"
      breadcrumbs={[
        { label: 'Organization' },
        { label: 'Elections', href: `/org/${orgSlug}/elections` },
        { label: 'Details' },
      ]}
    >
      <div className="space-y-6">
        <GlassCard className="p-6">
          <MemberElectionDetail electionId={electionId} orgId={orgId} userId={user?.id} />
        </GlassCard>
      </div>
    </PageShell>
  )
}
