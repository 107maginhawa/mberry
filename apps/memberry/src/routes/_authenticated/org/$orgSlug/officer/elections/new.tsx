import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ElectionForm } from '@/features/elections/components/election-form'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/elections/new')({
  component: NewElection,
})

function NewElection() {
  const { orgId, orgSlug } = useOrg()
  const navigate = useNavigate()

  return (
    <PageShell
      title="New Election"
      subtitle="Set up an election or bylaw vote"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Elections', href: `/org/${orgSlug}/officer/elections` },
        { label: 'New' },
      ]}
    >
      <GlassCard className="p-6">
        <ElectionForm
          orgId={orgId}
          onSuccess={(election) => {
            navigate({
              to: '/org/$orgSlug/officer/elections/$electionId',
              params: { orgSlug, electionId: election.id },
            })
          }}
          onCancel={() => {
            navigate({
              to: '/org/$orgSlug/officer/elections',
              params: { orgSlug },
            })
          }}
        />
      </GlassCard>
    </PageShell>
  )
}
