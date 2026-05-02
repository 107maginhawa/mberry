import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ElectionForm } from '@/features/elections/components/election-form'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/elections/new')({
  component: NewElection,
})

function NewElection() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div>
        <a
          href={`/org/${orgId}/officer/elections`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Elections
        </a>
        <h1 className="text-2xl font-bold mt-2">New Election</h1>
        <p className="text-sm text-muted-foreground">Set up an election or bylaw vote</p>
      </div>

      <div className="border rounded-lg p-6">
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
      </div>
    </div>
  )
}
