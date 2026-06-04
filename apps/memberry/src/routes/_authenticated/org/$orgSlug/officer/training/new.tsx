import { createFileRoute } from '@tanstack/react-router'
import { TrainingForm } from '@/features/training/components/training-form'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/training/new')({
  component: NewTraining,
})

function NewTraining() {
  const { orgId, orgSlug } = useOrg()

  return (
    <PageShell
      title="Create Training"
      subtitle="Define a new training session or course"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Training', href: `/org/${orgSlug}/officer/training` },
        { label: 'New' },
      ]}
    >
      <GlassCard className="p-6">
        <TrainingForm orgId={orgId} />
      </GlassCard>
    </PageShell>
  )
}
