import { createFileRoute, Outlet, useMatch } from '@tanstack/react-router'
import { ElectionDetail } from '@/features/elections/components/election-detail'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/elections/$electionId')({
  component: ElectionDetailLayout,
})

function ElectionDetailLayout() {
  const { orgId, electionId } = Route.useParams()

  // Check if a child route (e.g. /edit) is active
  const childMatch = useMatch({
    from: '/_authenticated/org/$orgId/officer/elections/$electionId/edit',
    shouldThrow: false,
  })

  // If child route is active, render it via Outlet
  if (childMatch) {
    return <Outlet />
  }

  // Otherwise render the detail page
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
