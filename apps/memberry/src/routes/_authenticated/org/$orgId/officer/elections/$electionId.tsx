import { createFileRoute } from '@tanstack/react-router'
import { ElectionDetail } from '@/features/elections/components/election-detail'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/elections/$electionId')({
  component: ElectionDetailPage,
})

function ElectionDetailPage() {
  const { orgId, electionId } = Route.useParams()

  return (
    <div className="space-y-6 p-6">
      <a
        href={`/org/${orgId}/officer/elections`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to Elections
      </a>

      <ElectionDetail electionId={electionId} orgId={orgId} />
    </div>
  )
}
