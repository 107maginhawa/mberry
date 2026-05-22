import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ElectionForm } from '@/features/elections/components/election-form'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/elections/new')({
  component: NewElection,
})

function NewElection() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="New Election"
        subtitle="Set up an election or bylaw vote"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Elections', href: `/org/${orgId}/officer/elections` },
          { label: 'New' },
        ]}
      />

      <GlassCard className="p-6">
        <ElectionForm
          orgId={orgId}
          onSuccess={(election) => {
            navigate({
              to: '/org/$orgId/officer/elections/$electionId',
              params: { orgId, electionId: election.id },
            })
          }}
          onCancel={() => {
            navigate({
              to: '/org/$orgId/officer/elections',
              params: { orgId },
            })
          }}
        />
      </GlassCard>
    </div>
  )
}
