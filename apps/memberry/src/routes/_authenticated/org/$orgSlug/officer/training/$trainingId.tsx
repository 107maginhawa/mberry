import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@monobase/ui'
import { Calendar, MapPin, Users, Award, Edit2 } from 'lucide-react'
import { TrainingForm } from '@/features/training/components/training-form'
import { CompletionTable } from '@/features/training/components/completion-table'
import { getTrainingOptions } from '@monobase/sdk-ts/generated/react-query'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'
import { useOrg } from '@/hooks/useOrg'

/** Runtime training shape from API (SDK returns unknown for GetTraining) */
interface RuntimeTraining {
  id?: string
  title?: string
  status?: string
  type?: string
  description?: string
  creditAmount?: number | string
  startDate?: string | null
  endDate?: string | null
  location?: string | null
  capacity?: number | null
  enrollmentCount?: number
  attendance?: { completed?: number }
  [key: string]: unknown
}

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/training/$trainingId')({
  component: TrainingDetail,
})

const TYPE_LABELS: Record<string, string> = {
  seminar: 'Seminar',
  workshop: 'Workshop',
  convention: 'Convention',
  online_course: 'Online Course',
  skills_training: 'Skills Training',
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  cancelled: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  pending_approval: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Tab = 'details' | 'edit' | 'attendance'

function TrainingDetail() {
  const { orgId, orgSlug } = useOrg()
  const { trainingId } = Route.useParams()
  const [tab, setTab] = useState<Tab>('details')

  const { data, isLoading, isError, error } = useQuery(
    getTrainingOptions({ path: { trainingId }, headers: { 'x-org-id': orgId } })
  )

  // SDK GetTraining returns unknown; runtime response may wrap in .data
  const training = ((data as RuntimeTraining | undefined)?.data ?? data) as RuntimeTraining | undefined

  const trainingBreadcrumbs = [
    { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
    { label: 'Training', href: `/org/${orgSlug}/officer/training` },
  ]

  if (isLoading) {
    return (
      <PageShell title="Training" breadcrumbs={trainingBreadcrumbs}>
        <div className="space-y-4">
          <div className="h-8 w-48 bg-[var(--color-surface-warm)] rounded animate-pulse" />
          <ListSkeleton rows={4} />
        </div>
      </PageShell>
    )
  }

  if (isError) {
    return (
      <PageShell title="Training" breadcrumbs={trainingBreadcrumbs}>
        <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          Unable to load training detail. Please try refreshing the page.
        </div>
      </PageShell>
    )
  }

  if (error || !training) {
    return (
      <PageShell title="Training" breadcrumbs={trainingBreadcrumbs}>
        <p className="text-[var(--color-error)]">Failed to load training.</p>
      </PageShell>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'attendance', label: `Attendance (${training.attendance?.completed ?? 0})` },
    { key: 'edit', label: 'Edit' },
  ]

  return (
    <PageShell
      title={training.title ?? ''}
      breadcrumbs={[...trainingBreadcrumbs, { label: training.title ?? '' }]}
      actions={
        <Button
          variant="outline"
          onClick={() => setTab('edit')}
        >
          <Edit2 className="w-4 h-4 mr-1.5" /> Edit
        </Button>
      }
    >
      <div className="space-y-6">
      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          {training.type ? (TYPE_LABELS[training.type] ?? training.type) : null}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${training.status ? (STATUS_STYLES[training.status] ?? 'bg-muted text-muted-foreground') : 'bg-muted text-muted-foreground'}`}>
          {training.status?.replace('_', ' ')}
        </span>
        {Number(training.creditAmount) > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
            <Award className="w-3 h-3" />
            {training.creditAmount} CPE
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0">
        {tabs.map((t) => (
          <Button
            key={t.key}
            variant="ghost"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px rounded-none ${
              tab === t.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-4">
            {training.description && (
              <GlassCard className="p-5">
                <h2 className="text-h4 mb-2">About</h2>
                <p className="text-sm text-[var(--color-muted)] whitespace-pre-line">{training.description}</p>
              </GlassCard>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <GlassCard className="p-5 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                <div>
                  <p className="font-medium">Start</p>
                  <p className="text-[var(--color-muted)]">{formatDate(training.startDate)}</p>
                  {training.endDate && (
                    <>
                      <p className="font-medium mt-1">End</p>
                      <p className="text-[var(--color-muted)]">{formatDate(training.endDate)}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                <div>
                  <p className="font-medium">Location</p>
                  <p className="text-[var(--color-muted)]">{training.location ?? 'TBA'}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                <div>
                  <p className="font-medium">Enrollment</p>
                  <p className="text-[var(--color-muted)]">
                    {training.enrollmentCount ?? 0} enrolled
                    {training.capacity ? ` / ${training.capacity} capacity` : ' (unlimited)'}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <CompletionTable orgId={orgId} trainingId={trainingId} creditAmount={training.creditAmount ?? 0} />
      )}

      {tab === 'edit' && (
        <TrainingForm orgId={orgId} trainingId={trainingId} initial={training} />
      )}
      </div>
    </PageShell>
  )
}
