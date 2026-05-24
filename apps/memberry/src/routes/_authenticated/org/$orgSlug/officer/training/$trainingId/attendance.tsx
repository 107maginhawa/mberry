import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@monobase/ui'
import { Checkbox } from '@monobase/ui'
import { Loader2, Users, UserCheck } from 'lucide-react'
import { listCustomTrainingEnrollmentsOptions, checkInCustomTrainingMutation } from '@monobase/sdk-ts/generated/react-query'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute(
  '/_authenticated/org/$orgSlug/officer/training/$trainingId/attendance',
)({
  component: TrainingAttendance,
})

function TrainingAttendance() {
  const { orgId, orgSlug } = useOrg()
  const { trainingId } = Route.useParams()
  const queryClient = useQueryClient()
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set())

  const { data, isLoading, error } = useQuery(
    listCustomTrainingEnrollmentsOptions({ path: { trainingId }, query: { organizationId: orgId } })
  )

  const checkInMutOpts = checkInCustomTrainingMutation()
  const checkInMutation = useMutation({
    mutationFn: (memberId: string) => (checkInMutOpts.mutationFn as (...args: any[]) => any)({
      path: { trainingId },
      query: { organizationId: orgId },
    }),
    onSuccess: (_data, memberId) => {
      setCheckedIn((prev) => new Set(prev).add(memberId))
      queryClient.invalidateQueries({ queryKey: ['listCustomTrainingEnrollments'] })
      toast.success('Member checked in successfully')
    },
    onError: (err: any) => {
      // BR-17: show "Already checked in" as a warning, not a hard error
      const message = err?.body?.message ?? err?.message ?? 'Check-in failed'
      if (message.toLowerCase().includes('already')) {
        toast.warning('Already checked in')
      } else {
        toast.error(message)
      }
    },
  })

  const enrollments = data?.data ?? []
  const presentCount = enrollments.filter(
    (e: any) => e.checkedIn || checkedIn.has(e.memberId ?? e.personId),
  ).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training Attendance"
        subtitle="Mark members as present for this training session"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Training', href: `/org/${orgSlug}/officer/training` },
          { label: 'Attendance' },
        ]}
        actions={
          <GlassCard className="px-3 py-2">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[var(--color-muted)]" />
              <span className="text-sm font-medium">
                {presentCount} / {enrollments.length} present
              </span>
            </div>
          </GlassCard>
        }
      />

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : error ? (
        <div className="p-6 text-center text-[var(--color-error)]">
          Failed to load enrollments.
        </div>
      ) : enrollments.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          headline="No enrollments yet"
          description="Members who enroll in this training will appear here."
        />
      ) : (
        <GlassCard>
          <div className="divide-y">
            {enrollments.map((enrollment: any) => {
              const memberId = enrollment.memberId ?? enrollment.personId
              const isPresent = enrollment.checkedIn || checkedIn.has(memberId)

              return (
                <div
                  key={enrollment.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-warm)]"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isPresent}
                      disabled={isPresent || checkInMutation.isPending}
                      onCheckedChange={() => {
                        if (!isPresent) {
                          checkInMutation.mutate(memberId)
                        }
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {enrollment.memberName ?? enrollment.personName ?? memberId}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {enrollment.email ?? `ID: ${memberId}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPresent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <UserCheck className="w-3 h-3" /> Present
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={checkInMutation.isPending}
                        onClick={() => checkInMutation.mutate(memberId)}
                      >
                        {checkInMutation.isPending &&
                        checkInMutation.variables === memberId ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          'Mark Present'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
