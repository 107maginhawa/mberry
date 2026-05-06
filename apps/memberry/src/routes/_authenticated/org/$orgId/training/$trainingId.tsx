import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, Award, DollarSign, Clock, BookOpen, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getTrainingOptions, enrollInCustomTrainingMutation } from '@monobase/sdk-ts/generated/react-query'

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
    mutationFn: () => (enrollMutOpts.mutationFn as Function)({ path: { trainingId }, query: { organizationId: orgId } }),
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
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-2/3 rounded-[12px]" />
        <Skeleton className="h-4 w-1/2 rounded-[12px]" />
        <Skeleton className="h-48 rounded-[12px]" />
        <Skeleton className="h-12 w-40 rounded-[12px]" />
      </div>
    )
  }

  if (error || !training) {
    return (
      <div className="p-6">
        <div
          className="rounded-[12px] p-8 text-center text-destructive"
          style={{ border: '1px solid var(--color-border-light)' }}
        >
          Failed to load training details.
        </div>
      </div>
    )
  }

  const creditAmount = training.creditAmount ?? training.credits
  const fee = training.fee ?? training.price

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          {training.title}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {training.status && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {training.status}
            </span>
          )}
          {training.type && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground capitalize">
              {training.type.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Details card */}
      <div
        className="rounded-[12px] p-5 space-y-4"
        style={{ border: '1px solid var(--color-border-light)' }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted)' }} />
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Start Date</p>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                {formatDate(training.startDate)}
              </p>
            </div>
          </div>

          {training.endDate && (
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted)' }} />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>End Date</p>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                  {formatDate(training.endDate)}
                </p>
              </div>
            </div>
          )}

          {creditAmount != null && Number(creditAmount) > 0 && (
            <div className="flex items-center gap-3">
              <Award className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted)' }} />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Credit Hours</p>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                  {creditAmount} CPE
                </p>
              </div>
            </div>
          )}

          {fee != null && Number(fee) > 0 && (
            <div className="flex items-center gap-3">
              <DollarSign className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted)' }} />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Fee</p>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                  PHP {Number(fee).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}
        </div>

        {training.provider && (
          <div className="flex items-center gap-3">
            <BookOpen className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted)' }} />
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Provider</p>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>{training.provider}</p>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      {training.description && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            About this Training
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-muted)' }}>
            {training.description}
          </p>
        </div>
      )}

      {/* Enroll */}
      <div className="pt-2">
        {enrolled ? (
          <div
            className="rounded-[12px] p-4 text-center text-sm font-medium"
            style={{ border: '1px solid var(--color-border-light)', color: 'var(--color-text)' }}
          >
            You are enrolled in this training.
          </div>
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
