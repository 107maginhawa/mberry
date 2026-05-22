import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@monobase/ui'
import { Calendar, MapPin, Users, Award, Edit2 } from 'lucide-react'
import { TrainingForm } from '@/features/training/components/training-form'
import { CompletionTable } from '@/features/training/components/completion-table'
import { getTrainingOptions } from '@monobase/sdk-ts/generated/react-query'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'

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

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/training/$trainingId')({
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
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Tab = 'details' | 'edit' | 'attendance'

function TrainingDetail() {
  const { orgId, trainingId } = Route.useParams()
  const [tab, setTab] = useState<Tab>('details')

  const { data, isLoading, error } = useQuery(
    getTrainingOptions({ path: { trainingId } })
  )

  // SDK GetTraining returns unknown; runtime response may wrap in .data
  const training = ((data as RuntimeTraining | undefined)?.data ?? data) as RuntimeTraining | undefined

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-[var(--color-surface-warm)] rounded animate-pulse" />
        <ListSkeleton rows={4} />
      </div>
    )
  }

  if (error || !training) {
    return (
      <div>
        <p className="text-[var(--color-error)]">Failed to load training.</p>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'attendance', label: `Attendance (${training.attendance?.completed ?? 0})` },
    { key: 'edit', label: 'Edit' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={training.title ?? ''}
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Training', href: `/org/${orgId}/officer/training` },
          { label: training.title ?? '' },
        ]}
        actions={
          <Button
            variant="outline"
            onClick={() => setTab('edit')}
          >
            <Edit2 className="w-4 h-4 mr-1.5" /> Edit
          </Button>
        }
      />

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          {training.type ? (TYPE_LABELS[training.type] ?? training.type) : null}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium ${training.status ? (STATUS_STYLES[training.status] ?? 'bg-gray-100 text-gray-700') : 'bg-gray-100 text-gray-700'}`}>
          {training.status?.replace('_', ' ')}
        </span>
        {Number(training.creditAmount) > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-amber-100 text-amber-700">
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
            className={`px-4 py-2 text-[14px] font-medium border-b-2 -mb-px rounded-none ${
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
                <p className="text-[14px] text-[var(--color-muted)] whitespace-pre-line">{training.description}</p>
              </GlassCard>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <GlassCard className="p-5 space-y-3 text-[14px]">
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
  )
}
