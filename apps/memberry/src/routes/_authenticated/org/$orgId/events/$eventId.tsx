import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, MapPin, Users, Clock, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/org/$orgId/events/$eventId')({
  component: EventDetail,
})

function formatDateTime(iso: string | null | undefined) {
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

function EventDetail() {
  const { eventId } = Route.useParams()
  const queryClient = useQueryClient()
  const [registered, setRegistered] = useState(false)

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['event-detail', eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/detail/${eventId}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load event')
      return res.json() as Promise<{ data: any }>
    },
    select: (d) => d.data,
  })

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/register/${eventId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? 'Registration failed')
      }
      return res.json()
    },
    onSuccess: (data) => {
      const status = data?.data?.status
      if (status === 'waitlisted') {
        toast.info('You have been added to the waitlist.')
      } else {
        toast.success('Successfully registered for this event!')
      }
      setRegistered(true)
      queryClient.invalidateQueries({ queryKey: ['event-detail', eventId] })
      queryClient.invalidateQueries({ queryKey: ['my-events'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
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

  if (error || !event) {
    return (
      <div className="p-6">
        <div
          className="rounded-[12px] p-8 text-center text-destructive"
          style={{ border: '1px solid var(--color-border-light)' }}
        >
          Failed to load event details.
        </div>
      </div>
    )
  }

  const capacity = event.capacity ?? event.maxAttendees
  const spotsUsed = event.registrationCount ?? event.attendeeCount ?? 0
  const spotsRemaining = capacity != null ? Math.max(0, capacity - spotsUsed) : null
  const isFull = spotsRemaining != null && spotsRemaining <= 0

  const cancellationDeadline = event.cancellationDeadline ?? event.registrationDeadline
  const deadlinePassed = cancellationDeadline ? new Date(cancellationDeadline) < new Date() : false

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          {event.title}
        </h1>
        {event.status && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {event.status}
          </span>
        )}
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
              <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Start</p>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                {formatDateTime(event.startDate)}
              </p>
            </div>
          </div>

          {event.endDate && (
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted)' }} />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>End</p>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                  {formatDateTime(event.endDate)}
                </p>
              </div>
            </div>
          )}

          {event.location && (
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted)' }} />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Location</p>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>{event.location}</p>
              </div>
            </div>
          )}

          {capacity != null && (
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted)' }} />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Capacity</p>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                  {spotsRemaining} of {capacity} spots remaining
                </p>
              </div>
            </div>
          )}
        </div>

        {cancellationDeadline && (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              Cancellation deadline: {formatDateTime(cancellationDeadline)}
              {deadlinePassed && ' (passed)'}
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      {event.description && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            About this Event
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-muted)' }}>
            {event.description}
          </p>
        </div>
      )}

      {/* Register / Waitlist */}
      <div className="pt-2">
        {registered ? (
          <div
            className="rounded-[12px] p-4 text-center text-sm font-medium"
            style={{ border: '1px solid var(--color-border-light)', color: 'var(--color-text)' }}
          >
            You are registered for this event.
          </div>
        ) : (
          <Button
            size="lg"
            disabled={registerMutation.isPending}
            onClick={() => registerMutation.mutate()}
          >
            {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isFull ? 'Join Waitlist' : 'Register'}
          </Button>
        )}

        {isFull && !registered && (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-muted)' }}>
            This event is at capacity. Registering will place you on the waitlist.
          </p>
        )}
      </div>
    </div>
  )
}
