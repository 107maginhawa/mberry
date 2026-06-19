import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@monobase/ui'
import { Calendar, Award, DollarSign, Clock, BookOpen, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getTrainingOptions,
  enrollInCustomTrainingMutation,
  listMyCustomTrainingsOptions,
} from '@monobase/sdk-ts/generated/react-query'
import { PageShell } from '@/components/patterns/page-shell'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/training/$trainingId')({
  component: TrainingDetail,
})

/** Runtime training shape from API (SDK returns unknown for GetTraining) */
interface RuntimeTraining {
  id?: string
  title?: string
  status?: string
  type?: string
  description?: string
  creditAmount?: number | string
  credits?: number | string
  fee?: number | string
  price?: number | string
  startDate?: string | null
  endDate?: string | null
  location?: string | null
  capacity?: number | null
  provider?: string | null
  [key: string]: unknown
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TrainingDetail() {
  const { orgId, orgSlug } = useOrg()
  const { trainingId } = Route.useParams()
  const queryClient = useQueryClient()

  const { data: training, isLoading, error } = useQuery({
    ...getTrainingOptions({ path: { trainingId } }),
    select: (d) => ((d as RuntimeTraining)?.data ?? d) as RuntimeTraining,
  })

  // Query server for enrollment status instead of using local state
  const { data: myTrainings } = useQuery({
    ...listMyCustomTrainingsOptions({ query: { organizationId: orgId } }),
    select: (d) => (d as any)?.data ?? d,
  })
  const enrolled = Array.isArray(myTrainings)
    ? myTrainings.some((t: any) => t.id === trainingId || t.trainingId === trainingId)
    : false

  const enrollMutOpts = enrollInCustomTrainingMutation()
  const enrollMutation = useMutation({
    mutationFn: () => (enrollMutOpts.mutationFn as (...args: any[]) => any)({ path: { trainingId }, query: { organizationId: orgId } }),
    onSuccess: () => {
      toast.success('Successfully enrolled in this training!')
      // Invalidate enrollment query to refresh enrolled state from server
      queryClient.invalidateQueries({ queryKey: listMyCustomTrainingsOptions({ query: { organizationId: orgId } }).queryKey })
      queryClient.invalidateQueries({ queryKey: ['training-detail', trainingId] })
    },
    onError: (err: any) => {
      toast.error(err?.body?.message ?? err?.message ?? 'Enrollment failed')
    },
  })

  if (isLoading) {
    return (
      <PageShell
        title=""
        breadcrumbs={[
          { label: 'Training', href: `/org/${orgSlug}/training` },
          { label: 'Loading...' },
        ]}
      >
        <div className="space-y-6 max-w-3xl">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </PageShell>
    )
  }

  if (error || !training) {
    return (
      <PageShell
        title="Training Not Found"
        breadcrumbs={[
          { label: 'Training', href: `/org/${orgSlug}/training` },
          { label: 'Error' },
        ]}
      >
        <div className="space-y-6 max-w-3xl">
          <GlassCard className="p-8 text-center">
            <p className="text-sm text-[var(--color-muted)]">Failed to load training details.</p>
          </GlassCard>
        </div>
      </PageShell>
    )
  }

  const creditAmount = training.creditAmount ?? training.credits
  const fee = training.fee ?? training.price

  return (
    <PageShell
      title={training.title ?? ''}
      breadcrumbs={[
        { label: 'Training', href: `/org/${orgSlug}/training` },
        { label: training.title ?? '' },
      ]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {training.status && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-green-900/30 dark:text-green-400">
              {training.status}
            </span>
          )}
          {training.type && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-warm)] text-[var(--color-muted)] capitalize">
              {training.type.replace('_', ' ')}
            </span>
          )}
        </div>
      }
    >
      <div className="space-y-6 max-w-3xl">
      {/* Details card */}
      <GlassCard className="p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
            <div>
              <p className="text-xs font-medium text-[var(--color-muted)]">Start Date</p>
              <p className="text-sm">{formatDate(training.startDate)}</p>
            </div>
          </div>

          {training.endDate && (
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              <div>
                <p className="text-xs font-medium text-[var(--color-muted)]">End Date</p>
                <p className="text-sm">{formatDate(training.endDate)}</p>
              </div>
            </div>
          )}

          {creditAmount != null && Number(creditAmount) > 0 && (
            <div className="flex items-center gap-3">
              <Award className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              <div>
                <p className="text-xs font-medium text-[var(--color-muted)]">Credit Hours</p>
                <p className="text-sm font-semibold text-[var(--color-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <CountUp value={Number(creditAmount)} /> CPE
                </p>
              </div>
            </div>
          )}

          {fee != null && Number(fee) > 0 && (
            <div className="flex items-center gap-3">
              <DollarSign className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              <div>
                <p className="text-xs font-medium text-[var(--color-muted)]">Fee</p>
                <p className="text-sm">
                  PHP {Number(fee).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}
        </div>

        {training.provider && (
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--color-border-light)]">
            <BookOpen className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
            <div>
              <p className="text-xs font-medium text-[var(--color-muted)]">Provider</p>
              <p className="text-sm">{training.provider}</p>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Description */}
      {training.description && (
        <GlassCard className="p-5 space-y-2">
          <h2 className="text-h4">About this Training</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-muted)]">
            {training.description}
          </p>
        </GlassCard>
      )}

      {/* Enroll */}
      <div className="pt-2">
        {enrolled ? (
          <GlassCard className="p-4 text-center">
            <p className="text-sm font-medium">You are enrolled in this training.</p>
          </GlassCard>
        ) : (
          <Button
            size="lg"
            disabled={enrollMutation.isPending}
            onClick={() => enrollMutation.mutate()}
          >
            {enrollMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enroll
          </Button>
        )}
      </div>
      </div>
    </PageShell>
  )
}
