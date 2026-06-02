import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { searchTrainingsOptions } from '@monobase/sdk-ts/generated/react-query'
import { Award, BookOpen } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'
import { EmptyState } from '@/components/patterns/empty-state'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { GlassCard } from '@/components/motion/glass-card'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/training/')({
  component: OrgTraining,
})

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function OrgTraining() {
  const { orgId, orgSlug } = useOrg()

  const { data, isLoading, error } = useQuery({
    ...searchTrainingsOptions({ query: { status: 'published' }, headers: { 'x-org-id': orgId } }),
    enabled: !!orgId,
  })

  const trainings = (data?.data ?? []) as unknown[]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training & Courses"
        subtitle="Browse and enroll in training sessions"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : error ? (
        <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          Unable to load training. Please try refreshing the page.
        </div>
      ) : trainings.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={32} />}
          headline="No training sessions available"
          description="Check back later for upcoming training sessions and courses."
        />
      ) : (
        <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {trainings.map((t: any) => (
            <StaggerItem key={t.id}>
              <Link
                to="/org/$orgSlug/training/$trainingId"
                params={{ orgSlug, trainingId: t.id }}
                className="block"
              >
                <GlassCard className="p-5 hover:bg-[var(--color-surface-elevated-hover)] transition-colors">
                  <p className="text-sm font-semibold line-clamp-1">{t.title}</p>
                  <p className="text-xs text-[var(--color-muted)] mt-1 capitalize">{t.type?.replace('_', ' ')}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-[var(--color-muted)]">
                    <span>{formatDate(t.startDate ?? t.startAt)}</span>
                    {Number(t.creditAmount ?? t.creditValue ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 font-medium">
                        <Award className="w-3 h-3" />
                        {t.creditAmount ?? t.creditValue} CPE
                      </span>
                    )}
                  </div>
                  {t.instructor && (
                    <p className="text-xs text-[var(--color-muted)] mt-2">Instructor: {t.instructor}</p>
                  )}
                </GlassCard>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </div>
  )
}
