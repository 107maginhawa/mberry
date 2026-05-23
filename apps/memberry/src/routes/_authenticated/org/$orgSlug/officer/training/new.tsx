import { createFileRoute } from '@tanstack/react-router'
import { TrainingForm } from '@/features/training/components/training-form'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/training/new')({
  component: NewTraining,
})

function NewTraining() {
  const { orgId, orgSlug } = useOrg()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Training"
        subtitle="Define a new training session or course"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Training', href: `/org/${orgSlug}/officer/training` },
          { label: 'New' },
        ]}
      />

      <GlassCard className="p-6">
        <TrainingForm orgId={orgId} />
      </GlassCard>
    </div>
  )
}
