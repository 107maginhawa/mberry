import { createFileRoute } from '@tanstack/react-router'
import { TrainingForm } from '@/features/training/components/training-form'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/training/new')({
  component: NewTraining,
})

function NewTraining() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Training"
        subtitle="Define a new training session or course"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Training', href: `/org/${orgId}/officer/training` },
          { label: 'New' },
        ]}
      />

      <GlassCard className="p-6">
        <TrainingForm orgId={orgId} />
      </GlassCard>
    </div>
  )
}
