import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@monobase/ui'
import { Calendar, Award, DollarSign, Clock, BookOpen, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getTrainingOptions, enrollInCustomTrainingMutation } from '@monobase/sdk-ts/generated/react-query'
import { PageHeader } from '@/components/patterns/page-header'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'

export const Route = createFileRoute('/_authenticated/org/$orgId/training/$trainingId')({
  component: TrainingDetail,
})

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
  const { orgId, trainingId } = Route.useParams()
  const queryClient = useQueryClient()
  const [enrolled, setEnrolled] = useState(false)

  const { data: training, isLoading, error } = useQuery({
    ...getTrainingOptions({ path: { trainingId } }),
    select: (d) => (d as any)?.data ?? d,
  })

  const enrollMutOpts = enrollInCustomTrainingMutation()
  const enrollMutation = useMutation({
    mutationFn: () => (enrollMutOpts.mutationFn as (...args: any[]) => any)({ path: { trainingId }, query: { organizationId: orgId } }),
    onSuccess: () => {
      toast.success('Successfully enrolled in this training!')
      setEnrolled(true)
      queryClient.invalidateQueries({ queryKey: ['training-detail', trainingId] })
      queryClient.invalidateQueries({ queryKey: ['my-trainings'] })
    },
    onError: (err: any) => {
      toast.error(err?.body?.message ?? err?.message ?? 'Enrollment failed')
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <PageHeader
          title=""
          breadcrumbs={[
            { label: 'Training', href: `/org/${orgId}/training` },
            { label: 'Loading...' },
          ]}
        />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  if (error || !training) {
    return (
      <div className="space-y-6 max-w-3xl">
        <PageHeader
          title="Training Not Found"
          breadcrumbs={[
            { label: 'Training', href: `/org/${orgId}/training` },
            { label: 'Error' },
          ]}
        />
        <GlassCard className="p-8 text-center">
          <p className="text-[14px] text-[var(--color-muted)]">Failed to load training details.</p>
        </GlassCard>
      </div>
    )
  }

  const creditAmount = training.creditAmount ?? training.credits
  const fee = training.fee ?? training.price

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={training.title}
        breadcrumbs={[
          { label: 'Training', href: `/org/${orgId}/training` },
          { label: training.title },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {training.status && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                {training.status}
              </span>
            )}
            {training.type && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-surface-warm)] text-[var(--color-muted)] capitalize">
                {training.type.replace('_', ' ')}
              </span>
            )}
          </div>
        }
      />

      {/* Details card */}
      <GlassCard className="p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
            <div>
              <p className="text-[12px] font-medium text-[var(--color-muted)]">Start Date</p>
              <p className="text-[13px]">{formatDate(training.startDate)}</p>
            </div>
          </div>

          {training.endDate && (
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              <div>
                <p className="text-[12px] font-medium text-[var(--color-muted)]">End Date</p>
                <p className="text-[13px]">{formatDate(training.endDate)}</p>
              </div>
            </div>
          )}

          {creditAmount != null && Number(creditAmount) > 0 && (
            <div className="flex items-center gap-3">
              <Award className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              <div>
                <p className="text-[12px] font-medium text-[var(--color-muted)]">Credit Hours</p>
                <p className="text-[13px] font-semibold text-[var(--color-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <CountUp value={Number(creditAmount)} /> CPE
                </p>
              </div>
            </div>
          )}

          {fee != null && Number(fee) > 0 && (
            <div className="flex items-center gap-3">
              <DollarSign className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              <div>
                <p className="text-[12px] font-medium text-[var(--color-muted)]">Fee</p>
                <p className="text-[13px]">
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
              <p className="text-[12px] font-medium text-[var(--color-muted)]">Provider</p>
              <p className="text-[13px]">{training.provider}</p>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Description */}
      {training.description && (
        <GlassCard className="p-5 space-y-2">
          <h2 className="text-h4">About this Training</h2>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--color-muted)]">
            {training.description}
          </p>
        </GlassCard>
      )}

      {/* Enroll */}
      <div className="pt-2">
        {enrolled ? (
          <GlassCard className="p-4 text-center">
            <p className="text-[14px] font-medium">You are enrolled in this training.</p>
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
  )
}
