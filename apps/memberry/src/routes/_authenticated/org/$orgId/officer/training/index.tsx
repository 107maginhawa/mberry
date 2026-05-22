import { createFileRoute, Link } from '@tanstack/react-router'
import { TrainingList } from '@/features/training/components/training-list'
import { PageHeader } from '@/components/patterns/page-header'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/training/')({
  component: OfficerTraining,
})

function OfficerTraining() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training"
        subtitle="Manage training sessions and courses"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Training' },
        ]}
        actions={
          <Link
            to="/org/$orgId/officer/training/new"
            params={{ orgId }}
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
