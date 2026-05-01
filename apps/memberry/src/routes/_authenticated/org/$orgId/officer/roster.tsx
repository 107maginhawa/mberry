import { createFileRoute } from '@tanstack/react-router'
import { MembershipList } from '@/features/membership/components/membership-list'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/roster')({
  component: RosterPage,
})

function RosterPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Member Roster</h1>
      </div>

      <MembershipList orgId={orgId} tenantId={orgId} />
    </div>
  )
}
