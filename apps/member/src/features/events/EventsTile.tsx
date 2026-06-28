import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Skeleton, EmptyState, ErrorState, centavosToPhp } from '@monobase/ui'
import { toast } from 'sonner'
import type { Event } from '@monobase/sdk-ts/generated'
import { useMemberEvents } from './use-member-events'
import { useRsvp, isWaitlisted } from './use-rsvp'

function Title() {
  return <CardTitle className="text-body font-semibold text-muted-foreground">Upcoming events</CardTitle>
}

export function EventsTile() {
  const { isLoading, isError, data, refetch } = useMemberEvents()
  const rsvp = useRsvp()
  // Track local RSVPs so we disable the button after success — the engine has NO 409, a re-RSVP would 500.
  const [registered, setRegistered] = useState<Set<string>>(new Set())

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Title /></CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardHeader><Title /></CardHeader>
        <CardContent>
          <ErrorState bare message="We couldn't load events." onRetry={() => void refetch()} />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader><Title /></CardHeader>
        <CardContent>
          <EmptyState headline="No upcoming events" description="Check back later for chapter events." />
        </CardContent>
      </Card>
    )
  }

  function onRsvp(ev: Event) {
    rsvp.mutate({ eventId: ev.id }, {
      onSuccess: (reg) => {
        setRegistered((s) => new Set(s).add(ev.id))
        toast.success(isWaitlisted(reg) ? 'Added to the waitlist' : "You're registered")
      },
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <Card>
      <CardHeader><Title /></CardHeader>
      <CardContent className="space-y-4">
        {data.map((ev) => {
          const fee = ev.registrationFee ? Number(ev.registrationFee) : 0
          const isPaid = fee > 0
          const spotsLeft = ev.capacity != null ? ev.capacity - (ev.registeredCount ?? 0) : null
          const pendingThis = rsvp.isPending && rsvp.variables?.eventId === ev.id
          const isRegistered = registered.has(ev.id)
          return (
            <div key={ev.id} className="space-y-1 border-b pb-3 last:border-b-0 last:pb-0">
              <p className="text-body font-semibold text-foreground">{ev.title}</p>
              <p className="text-body text-muted-foreground">
                {new Date(ev.startDate as unknown as string | Date).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
              {(ev as Event & { location?: string }).location && (
                <p className="text-body text-muted-foreground">{(ev as Event & { location?: string }).location}</p>
              )}
              <p className="text-body text-foreground">{isPaid ? centavosToPhp(fee) : 'Free'}</p>
              {spotsLeft != null && (
                <p className="text-body text-muted-foreground">{spotsLeft} spots left</p>
              )}
              {isPaid
                ? <p className="text-body text-muted-foreground">Paid registration coming soon.</p>
                : (
                  <Button
                    className="min-h-tap"
                    disabled={pendingThis || isRegistered}
                    aria-label={`RSVP to ${ev.title}`}
                    onClick={() => onRsvp(ev)}
                  >
                    {isRegistered ? 'Registered' : pendingThis ? 'RSVPing…' : 'RSVP'}
                  </Button>
                )
              }
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
