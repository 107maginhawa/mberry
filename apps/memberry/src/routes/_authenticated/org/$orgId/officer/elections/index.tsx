import { createFileRoute, Link } from '@tanstack/react-router'
import { ElectionList } from '@/features/elections/components/election-list'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/elections/')({
  component: OfficerElections,
})

function OfficerElections() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Elections</h1>
          <p className="text-sm text-muted-foreground">Manage officer elections and bylaw votes</p>
        </div>
        <Link
          to="/org/$orgId/officer/elections/new"
          params={{ orgId }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          New Election
        </Link>
      </div>

      <ElectionList orgId={orgId} />
    </div>
  )
}
