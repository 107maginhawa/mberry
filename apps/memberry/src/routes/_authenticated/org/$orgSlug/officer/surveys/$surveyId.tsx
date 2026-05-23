import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { useOrg } from '@/hooks/useOrg'
import { SurveyResults } from '@/features/surveys/components/survey-results'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/surveys/$surveyId')({
  component: SurveyDetailPage,
})

function SurveyDetailPage() {
  const { orgId, orgSlug } = useOrg()
  const { surveyId } = Route.useParams()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Survey Results"
        subtitle="View responses and analytics"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Surveys', href: `/org/${orgSlug}/officer/surveys` },
          { label: 'Results' },
        ]}
      />

      <SurveyResults orgId={orgId} surveyId={surveyId} />
    </div>
  )
}
