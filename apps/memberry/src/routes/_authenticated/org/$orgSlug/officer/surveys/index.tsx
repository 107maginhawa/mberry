import { createFileRoute, Link } from '@tanstack/react-router'
import { PageShell } from '@/components/patterns/page-shell'
import { useOrg } from '@/hooks/useOrg'
import { SurveyList } from '@/features/surveys/components/survey-list'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/surveys/')({
  component: OfficerSurveys,
})

function OfficerSurveys() {
  const { orgSlug } = useOrg()

  return (
    <PageShell
      title="Surveys"
      subtitle="Create and manage member surveys"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Surveys' },
      ]}
      actions={
        <Link
          to="/org/$orgSlug/officer/surveys/new"
          params={{ orgSlug }}
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-[8px] text-sm font-medium hover:bg-[var(--color-primary-mid)]"
        >
          New Survey
        </Link>
      }
    >
      <SurveyList />
    </PageShell>
  )
}
