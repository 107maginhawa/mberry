import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Loader2, Users, UserCheck } from 'lucide-react'

export const Route = createFileRoute(
  '/_authenticated/org/$orgId/officer/training/$trainingId/attendance',
)({
  component: TrainingAttendance,
})

function TrainingAttendance() {
  const { orgId, trainingId } = Route.useParams()
  const queryClient = useQueryClient()
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set())

  const { data, isLoading, error } = useQuery({
    queryKey: ['training-enrollments', trainingId],
    queryFn: async () => {
      const res = await fetch(`/api/training/${orgId}/enrollments/${trainingId}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to load enrollments')
      return res.json() as Promise<{ data: any[] }>
    },
  })

  const checkInMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/training/${orgId}/${trainingId}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ memberId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // BR-17: duplicate check-in returns a specific message
        const message = (err as any).message ?? 'Check-in failed'
        if (message.toLowerCase().includes('already')) {
          throw new Error('Already checked in')
        }
        throw new Error(message)
      }
      return res.json()
    },
    onSuccess: (_data, memberId) => {
      setCheckedIn((prev) => new Set(prev).add(memberId))
      queryClient.invalidateQueries({ queryKey: ['training-enrollments', trainingId] })
      toast.success('Member checked in successfully')
    },
    onError: (err: Error) => {
      // BR-17: show "Already checked in" as a warning, not a hard error
      if (err.message === 'Already checked in') {
        toast.warning('Already checked in')
      } else {
        toast.error(err.message)
      }
    },
  })

  const enrollments = data?.data ?? []
  const presentCount = enrollments.filter(
    (e: any) => e.checkedIn || checkedIn.has(e.memberId ?? e.personId),
  ).length

  return (
    <div className="space-y-6 p-6">
      <a
        href={`/org/${orgId}/officer/training/${trainingId}`}
        className="inline-flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--color-muted)' }}
      >
        <ArrowLeft className="w-4 h-4" /> Back to Training
      </a>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Training Attendance
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            Mark members as present for this training session
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border"
          style={{ borderColor: 'var(--color-border-light)' }}
        >
          <UserCheck className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {presentCount} / {enrollments.length} present
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 text-center text-destructive">
          Failed to load enrollments.
        </div>
      ) : enrollments.length === 0 ? (
        <div
          className="border rounded-lg p-12 text-center"
          style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-muted)' }}
        >
          <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No enrollments yet</p>
          <p className="text-sm mt-1">Members who enroll in this training will appear here.</p>
        </div>
      ) : (
        <div
          className="border rounded-lg overflow-hidden divide-y"
          style={{ borderColor: 'var(--color-border-light)' }}
        >
          {enrollments.map((enrollment: any) => {
            const memberId = enrollment.memberId ?? enrollment.personId
            const isPresent = enrollment.checkedIn || checkedIn.has(memberId)

            return (
              <div
                key={enrollment.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/30"
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
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      {enrollment.memberName ?? enrollment.personName ?? memberId}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
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
      )}
    </div>
  )
}
