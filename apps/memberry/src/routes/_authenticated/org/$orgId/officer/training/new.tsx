import { createFileRoute } from '@tanstack/react-router'
import { TrainingForm } from '@/features/training/components/training-form'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/training/new')({
  component: NewTraining,
})

function NewTraining() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6 p-6">
      <div>
        <a
          href={`/org/${orgId}/officer/training`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Training
        </a>
        <h1 className="text-2xl font-bold">Create Training</h1>
        <p className="text-sm text-muted-foreground">Define a new training session or course</p>
      </div>

      <TrainingForm orgId={orgId} />
    </div>
  )
}
