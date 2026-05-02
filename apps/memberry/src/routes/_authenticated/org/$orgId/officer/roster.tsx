import { createFileRoute } from '@tanstack/react-router'
import { MemberTable } from '@/features/membership/components/member-table'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/roster')({
  component: RosterPage,
})

function RosterPage() {
  const { orgId } = Route.useParams()
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Member Roster</h1>
      <MemberTable orgId={orgId} />
    </div>
  )
}
