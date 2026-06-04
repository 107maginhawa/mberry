import { createFileRoute, Outlet, useMatch } from '@tanstack/react-router'
import { ElectionDetail } from '@/features/elections/components/election-detail'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/elections/$electionId')({
  component: ElectionDetailLayout,
})

function ElectionDetailLayout() {
  const { orgId, orgSlug } = useOrg()
  const { electionId } = Route.useParams()

  // Check if a child route (e.g. /edit) is active
  const childMatch = useMatch({
    from: '/_authenticated/org/$orgSlug/officer/elections/$electionId/edit',
    shouldThrow: false,
  })

  // If child route is active, render it via Outlet
  if (childMatch) {
    return <Outlet />
  }

  // Otherwise render the detail page
  return (
    <PageShell
      title="Election Details"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Elections', href: `/org/${orgSlug}/officer/elections` },
        { label: 'Details' },
      ]}
    >
      <GlassCard className="p-6">
        <ElectionDetail electionId={electionId} orgId={orgId} />
      </GlassCard>
    </PageShell>
  )
}
