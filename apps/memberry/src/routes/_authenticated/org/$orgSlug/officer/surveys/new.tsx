import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { useOrg } from '@/hooks/useOrg'
import { SurveyBuilder } from '@/features/surveys/components/survey-builder'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/surveys/new')({
  component: NewSurveyPage,
})

function NewSurveyPage() {
  const { orgId, orgSlug } = useOrg()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Survey"
        subtitle="Create a survey for your members"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Surveys', href: `/org/${orgSlug}/officer/surveys` },
          { label: 'New' },
        ]}
      />

      <div className="max-w-2xl">
        <SurveyBuilder
          orgId={orgId}
          onSuccess={(survey) =>
            navigate({
              to: '/org/$orgSlug/officer/surveys/$surveyId',
              params: { orgSlug, surveyId: survey.id },
            })
          }
          onCancel={() =>
            navigate({
              to: '/org/$orgSlug/officer/surveys',
              params: { orgSlug },
            })
          }
        />
      </div>
    </div>
  )
}
