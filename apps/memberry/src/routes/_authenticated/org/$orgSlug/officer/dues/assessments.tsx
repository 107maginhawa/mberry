import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'
import { useOrg } from '@/hooks/useOrg'
import { Skeleton } from '@monobase/ui'

const SpecialAssessmentsList = lazy(() =>
  import('@/features/dues/components/special-assessments-list').then(m => ({
    default: m.SpecialAssessmentsList,
  })),
)

export const Route = createFileRoute(
  '/_authenticated/org/$orgSlug/officer/dues/assessments',
)({
  component: AssessmentsPage,
})

function AssessmentsPage() {
  const { orgId } = useOrg()

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Special Assessments</h1>
      <p className="text-muted-foreground">
        Create one-time charges for members — building funds, special projects, or emergency levies.
      </p>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <SpecialAssessmentsList orgId={orgId} />
      </Suspense>
    </div>
  )
}
