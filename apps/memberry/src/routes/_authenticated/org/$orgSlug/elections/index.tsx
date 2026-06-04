import { createFileRoute } from '@tanstack/react-router'
import { MemberElectionList } from '@/features/elections/components/member-election-list'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/elections/')({
  component: MemberElectionsPage,
})

function MemberElectionsPage() {
  const { orgId } = useOrg()

  return (
    <PageShell
      title="Elections"
      subtitle="View elections and cast your vote"
      breadcrumbs={[
        { label: 'Organization' },
        { label: 'Elections' },
      ]}
    >
      <div className="space-y-6">
        <GlassCard className="p-6">
          <MemberElectionList orgId={orgId} />
        </GlassCard>
      </div>
    </PageShell>
  )
}
