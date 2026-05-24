import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Clock, CheckCircle2, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'
import { EmptyState } from '@/components/patterns/empty-state'
import { GlassCard } from '@/components/motion/glass-card'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/my/surveys/')({
  component: MySurveys,
})

interface SurveyListItem {
  id: string
  title: string
  description?: string
  surveyType: string
  status: string
  deadline?: string
  completedAt?: string
}

interface SurveyListResponse {
  data: SurveyListItem[]
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatSurveyType(type: string): string {
  const labels: Record<string, string> = {
    nps: 'NPS',
    satisfaction: 'Satisfaction',
    feedback: 'Feedback',
    poll: 'Poll',
    general: 'General',
  }
  return labels[type] ?? type.charAt(0).toUpperCase() + type.slice(1)
}

function isOverdue(deadline?: string): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

function MySurveys() {
  const { data, isLoading, error } = useQuery<SurveyListResponse>({
    queryKey: ['surveys', 'mine'],
    queryFn: () => api.get<SurveyListResponse>('/surveys?mine=true'),
  })

  const allSurveys = data?.data ?? []
  const pending = allSurveys.filter((s) => s.status === 'pending')
  const completed = allSurveys.filter((s) => s.status === 'completed')

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Surveys"
        subtitle="Share your feedback and see past responses"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <GlassCard key={i} className="p-5 space-y-3">
              <div className="h-5 w-20 rounded-[8px] bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
              <div className="h-5 w-3/4 rounded-[8px] bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
              <div className="h-4 w-1/2 rounded-[8px] bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
            </GlassCard>
          ))}
        </div>
      ) : error ? (
        <GlassCard className="p-6">
          <EmptyState
            icon={<ClipboardList className="w-8 h-8" />}
            headline="Failed to load surveys"
            description="Something went wrong. Please try again."
          />
        </GlassCard>
      ) : allSurveys.length === 0 ? (
        <GlassCard className="p-6">
          <EmptyState
            icon={<ClipboardList className="w-8 h-8" />}
            headline="No surveys yet"
            description="You'll see surveys here when they're assigned to you."
          />
        </GlassCard>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <section>
              <h2 className="text-h4 text-[var(--color-text)] mb-3 flex items-center gap-2">
                <Clock size={16} className="text-[var(--color-warning)]" />
                Pending ({pending.length})
              </h2>
              <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pending.map((survey) => (
                  <StaggerItem key={survey.id}>
                    <Link
                      to="/my/surveys/$surveyId"
                      params={{ surveyId: survey.id }}
                      className="block"
                    >
                      <GlassCard className="p-5 hover:bg-[var(--color-surface-elevated-hover)] transition-colors group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
                                Pending
                              </span>
                              <span className="text-xs text-[var(--color-muted)]">
                                {formatSurveyType(survey.surveyType)}
                              </span>
                            </div>
                            <h3 className="text-sm font-semibold text-[var(--color-text)]">
                              {survey.title}
                            </h3>
                            {survey.description && (
                              <p className="text-xs text-[var(--color-muted)] line-clamp-2">
                                {survey.description}
                              </p>
                            )}
                            {survey.deadline && (
                              <p
                                className={`text-xs font-medium ${
                                  isOverdue(survey.deadline)
                                    ? 'text-[var(--color-error)]'
                                    : 'text-[var(--color-muted)]'
                                }`}
                              >
                                {isOverdue(survey.deadline) ? 'Overdue' : 'Due'}: {formatDate(survey.deadline)}
                              </p>
                            )}
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-[var(--color-muted)] group-hover:text-[var(--color-primary)] transition-colors shrink-0 mt-1"
                          />
                        </div>
                      </GlassCard>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerGrid>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section>
              <h2 className="text-h4 text-[var(--color-text)] mb-3 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[var(--color-success)]" />
                Completed ({completed.length})
              </h2>
              <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completed.map((survey) => (
                  <StaggerItem key={survey.id}>
                    <GlassCard className="p-5 opacity-80">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-success-bg)] text-[var(--color-success)]">
                            Completed
                          </span>
                          <span className="text-xs text-[var(--color-muted)]">
                            {formatSurveyType(survey.surveyType)}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-[var(--color-text)]">
                          {survey.title}
                        </h3>
                        {survey.completedAt && (
                          <p className="text-xs text-[var(--color-muted)]">
                            Submitted: {formatDate(survey.completedAt)}
                          </p>
                        )}
                      </div>
                    </GlassCard>
                  </StaggerItem>
                ))}
              </StaggerGrid>
            </section>
          )}
        </>
      )}
    </div>
  )
}
