import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Loader2, Users, UserCheck } from 'lucide-react'
import { api } from '@/lib/api'

export const Route = createFileRoute(
  '/_authenticated/org/$orgId/officer/events/$eventId/attendance',
)({
  component: EventAttendance,
})

function EventAttendance() {
  const { orgId, eventId } = Route.useParams()
  const queryClient = useQueryClient()
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set())

  const { data, isLoading, error } = useQuery({
    queryKey: ['event-registrations', eventId],
    queryFn: () => api.get<{ data: any[] }>(`/api/events/${eventId}/registrations`),
  })

  const checkInMutation = useMutation({
    mutationFn: (memberId: string) => api.post(`/api/events/${eventId}/check-in`, { memberId }),
    onSuccess: (_data, memberId) => {
      setCheckedIn((prev) => new Set(prev).add(memberId))
      queryClient.invalidateQueries({ queryKey: ['event-registrations', eventId] })
      queryClient.invalidateQueries({ queryKey: ['attendance', eventId] })
      toast.success('Member checked in successfully')
    },
    onError: (err: any) => {
      toast.error(err?.body?.message ?? err?.message ?? 'Check-in failed')
    },
  })

  const registrations = data?.data ?? []
  const presentCount = registrations.filter(
    (r: any) => r.checkedIn || checkedIn.has(r.memberId ?? r.personId),
  ).length

  return (
    <div className="space-y-6 p-6">
      <a
        href={`/org/${orgId}/officer/events/${eventId}`}
        className="inline-flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--color-muted)' }}
      >
        <ArrowLeft className="w-4 h-4" /> Back to Event
      </a>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Event Attendance
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            Mark members as present for this event
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border"
          style={{ borderColor: 'var(--color-border-light)' }}
        >
          <UserCheck className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {presentCount} / {registrations.length} present
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
          Failed to load registrations.
        </div>
      ) : registrations.length === 0 ? (
        <div
          className="border rounded-lg p-12 text-center"
          style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-muted)' }}
        >
          <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No registrations yet</p>
          <p className="text-sm mt-1">Members who register for this event will appear here.</p>
        </div>
      ) : (
        <div
          className="border rounded-lg overflow-hidden divide-y"
          style={{ borderColor: 'var(--color-border-light)' }}
        >
          {registrations.map((reg: any) => {
            const memberId = reg.memberId ?? reg.personId
            const isPresent = reg.checkedIn || checkedIn.has(memberId)

            return (
              <div
                key={reg.id}
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
                      {reg.memberName ?? reg.personName ?? memberId}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                      {reg.email ?? `ID: ${memberId}`}
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
