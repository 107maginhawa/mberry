import { createFileRoute, Link } from '@tanstack/react-router'
import { TrainingList } from '@/features/training/components/training-list'
import { PageHeader } from '@/components/patterns/page-header'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/training/')({
  component: OfficerTraining,
})

function OfficerTraining() {
  const { orgId, orgSlug } = useOrg()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training"
        subtitle="Manage training sessions and courses"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Training' },
        ]}
        actions={
          <Link
            to="/org/$orgSlug/officer/training/new"
            params={{ orgSlug }}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-[8px] text-[14px] font-medium hover:bg-[var(--color-primary-mid)]"
          >
            Create Training
          </Link>
        }
      />

      <TrainingList orgId={orgId} />
    </div>
  )
}
