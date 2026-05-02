import { createFileRoute } from '@tanstack/react-router'
import { TrainingList } from '@/features/training/components/training-list'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/training/')({
  component: OfficerTraining,
})

function OfficerTraining() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Training</h1>
          <p className="text-sm text-muted-foreground">Manage training sessions and courses</p>
        </div>
        <a
          href={`/org/${orgId}/officer/training/new`}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
        >
          Create Training
        </a>
      </div>

      <TrainingList orgId={orgId} />
    </div>
  )
}
