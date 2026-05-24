import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'
import { useOrg } from '@/hooks/useOrg'
import { PageHeader } from '@/components/patterns/page-header'
import { Skeleton } from '@monobase/ui'

const SpecialAssessmentsList = lazy(() =>
  import('@/features/dues/components/special-assessments-list').then(m => ({
    default: m.SpecialAssessmentsList,
  })),
)

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/finances/assessments')({
  component: FinancesAssessmentsPage,
})

function FinancesAssessmentsPage() {
  const { orgId, orgSlug } = useOrg()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Special Assessments"
        subtitle="One-time charges — building funds, special projects, or emergency levies"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Finances', href: `/org/${orgSlug}/officer/finances` },
          { label: 'Assessments' },
        ]}
      />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <SpecialAssessmentsList orgId={orgId} />
      </Suspense>
    </div>
  )
}
