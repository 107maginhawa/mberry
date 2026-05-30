import { createFileRoute, useNavigate } from '@tanstack/react-router'
// oli-execute: error-handled-inline
// `error` triggers the EmptyState "Survey not found" branch at ~L33.
// Gate heuristic misses the destructured rename.
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { SurveyFlow } from '@/features/surveys/components/survey-flow'
import type { Survey } from '@/features/surveys/components/survey-flow'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { PageHeader } from '@/components/patterns/page-header'

export const Route = createFileRoute('/_authenticated/my/surveys/$surveyId')({
  component: SurveyDetailPage,
})

function SurveyDetailPage() {
  const { surveyId } = Route.useParams()
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery<Survey>({
    queryKey: ['surveys', surveyId],
    queryFn: () => api.get<Survey>(`/surveys/${surveyId}`),
    enabled: !!surveyId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Survey"
          breadcrumbs={[
            { label: 'My Surveys', href: '/my/surveys' },
            { label: 'Survey' },
          ]}
        />
        <GlassCard className="p-6">
          <EmptyState
            headline="Survey not found"
            description="This survey may have been removed or is no longer available."
          />
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.title}
        subtitle={data.description}
        breadcrumbs={[
          { label: 'My Surveys', href: '/my/surveys' },
          { label: data.title },
        ]}
      />
      <SurveyFlow
        survey={data}
        onComplete={() => {
          // Navigate back to list after a brief delay for the completion animation
          setTimeout(() => {
            navigate({ to: '/my/surveys' })
          }, 2500)
        }}
      />
    </div>
  )
}
