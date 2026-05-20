import { createFileRoute } from '@tanstack/react-router'
import type { ApiListResponse } from '@/types/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@monobase/ui'
import { Calendar, MapPin, Users, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { PageHeader } from '@/components/patterns/page-header'
import { EmptyState } from '@/components/patterns/empty-state'
import {
  getEventOptions,
  getEventQueryKey,
  registerForCustomEventMutation,
  cancelEventRegistrationMutation,
  listMyCustomEventsOptions,
  listMyCustomEventsQueryKey,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

export const Route = createFileRoute('/_authenticated/org/$orgId/events/$eventId')({
  component: EventDetail,
})

/** Extended event shape — API may return registeredCount beyond the base Event type */
interface EventWithCounts {
  registeredCount?: number
}

function formatDateTime(iso: string | Date | null | undefined) {
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
  const { orgId, eventId } = Route.useParams()
  const queryClient = useQueryClient()

  // Fetch event details
  const { data: event, isLoading, error } = useQuery({
    ...getEventOptions({ path: { eventId }, headers: { 'x-org-id': orgId } }),
    select: (d) => (d as unknown as { data?: typeof d })?.data ?? d,
  })

  // Derive registration state from server (survives reload)
  const { data: myEventsData } = useQuery(listMyCustomEventsOptions())
  const myReg = ((myEventsData as unknown as ApiListResponse<{ id?: string; regId?: string; event?: { id: string }; eventId?: string; registration?: { id?: string; status: string } }>)?.data ?? []).find(
    (r) => r.event?.id === eventId || r.eventId === eventId
  )
  const registered = !!myReg
  const registrationStatus = myReg?.registration?.status

  // Register mutation
  const registerMutation = useMutation({
    ...registerForCustomEventMutation(),
    onSuccess: (data: any) => {
      // Handler returns EventRegistration (status: 'confirmed') or WaitlistEntry (waitlisted: true)
      if (data?.waitlisted || data?.status === 'waitlisted') {
        toast.info('Added to waitlist.')
      } else {
        toast.success('Registered!')
      }
      queryClient.invalidateQueries({ queryKey: getEventQueryKey({ path: { eventId }, headers: { 'x-org-id': orgId } }) })
      queryClient.invalidateQueries({ queryKey: listMyCustomEventsQueryKey() })
    },
    onError: (err: any) => {
      const msg = err?.body?.message ?? err?.body?.error ?? err?.message ?? 'Registration failed'
      toast.error(msg)
    },
  })

  // Cancel registration mutation
  const cancelMutation = useMutation({
    ...cancelEventRegistrationMutation(),
    onSuccess: () => {
      toast.success('Registration cancelled.')
      queryClient.invalidateQueries({ queryKey: getEventQueryKey({ path: { eventId }, headers: { 'x-org-id': orgId } }) })
      queryClient.invalidateQueries({ queryKey: listMyCustomEventsQueryKey() })
    },
    onError: (err: any) => {
      const msg = err?.body?.message ?? err?.body?.error ?? err?.message ?? 'Cancellation failed'
      toast.error(msg)
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 max-w-3xl">
        <div className="h-8 w-2/3 rounded-[8px] bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
        <div className="h-4 w-1/2 rounded-[8px] bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
        <GlassCard className="p-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-[8px] bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
            ))}
          </div>
        </GlassCard>
        <div className="h-12 w-40 rounded-[8px] bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="p-6 max-w-3xl">
        <GlassCard className="p-6">
          <EmptyState
            icon={<Calendar className="w-8 h-8" />}
            headline="Failed to load event"
            description="Something went wrong. Please try again."
          />
        </GlassCard>
      </div>
    )
  }

  const capacity = event.capacity
  const spotsUsed = (event as unknown as EventWithCounts).registeredCount ?? 0
  const spotsRemaining = capacity != null ? Math.max(0, capacity - spotsUsed) : null
  const isFull = spotsRemaining != null && spotsRemaining <= 0

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <PageHeader
        title={event.title ?? 'Event'}
        subtitle={event.status ? `Status: ${event.status}` : undefined}
        breadcrumbs={[
          { label: 'Events', href: `/org/${orgId}/events` },
          { label: event.title ?? 'Event' },
        ]}
      />

      {/* Details card */}
      <GlassCard className="p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
            <div>
              <p className="text-body-sm font-medium text-[var(--color-muted)]">Start</p>
              <p className="text-body text-[var(--color-text)]">
                {formatDateTime(event.startDate)}
              </p>
            </div>
          </div>

          {event.endDate && (
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              <div>
                <p className="text-body-sm font-medium text-[var(--color-muted)]">End</p>
                <p className="text-body text-[var(--color-text)]">
                  {formatDateTime(event.endDate)}
                </p>
              </div>
            </div>
          )}

          {event.location && (
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              <div>
                <p className="text-body-sm font-medium text-[var(--color-muted)]">Location</p>
                <p className="text-body text-[var(--color-text)]">{event.location}</p>
              </div>
            </div>
          )}

          {capacity != null && (
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              <div>
                <p className="text-body-sm font-medium text-[var(--color-muted)]">Capacity</p>
                <p className="text-body text-[var(--color-text)]">
                  <CountUp value={spotsRemaining ?? 0} className="font-semibold" /> of{' '}
                  <CountUp value={capacity} className="font-semibold" /> spots remaining
                </p>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Description */}
      {event.description && (
        <div className="space-y-2">
          <h2 className="text-h3 text-[var(--color-text)]">
            About this Event
          </h2>
          <p className="text-body leading-relaxed whitespace-pre-wrap text-[var(--color-muted)]">
            {event.description}
          </p>
        </div>
      )}

      {/* Register / Waitlist / Cancel */}
      <div className="pt-2">
        {registered ? (
          <div className="space-y-3">
            <GlassCard className="p-4 text-center">
              <p className="text-body font-medium text-[var(--color-text)]">
                {registrationStatus === 'waitlisted'
                  ? 'You are on the waitlist for this event.'
                  : 'You are registered for this event.'}
              </p>
            </GlassCard>
            {registrationStatus !== 'cancelled' && (
              <Button
                variant="outline"
                size="sm"
                disabled={cancelMutation.isPending}
                onClick={() => {
                  const regId = myReg?.registration?.id ?? myReg?.regId ?? myReg?.id
                  if (regId) {
                    cancelMutation.mutate({ path: { registrationId: regId } })
                  } else {
                    toast.error('Unable to find registration. Please refresh and try again.')
                  }
                }}
              >
                {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cancel Registration
              </Button>
            )}
          </div>
        ) : (
          <>
            <Button
              size="lg"
              disabled={registerMutation.isPending}
              onClick={() => registerMutation.mutate({ path: { eventId }, headers: { 'x-org-id': orgId } })}
            >
              {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isFull ? 'Join Waitlist' : 'Register'}
            </Button>
            {isFull && (
              <p className="mt-2 text-body-sm text-[var(--color-muted)]">
                This event is at capacity. Registering will place you on the waitlist.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
