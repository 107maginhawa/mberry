import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  listBookingEventsOptions,
  listEventSlotsOptions,
  getPersonOptions,
} from '@monobase/sdk-ts/generated/react-query'
import type { Person } from '@monobase/sdk-ts/generated/types.gen'
import { Card, CardContent, CardHeader, CardTitle } from '@monobase/ui'
import { Avatar, AvatarFallback, AvatarImage } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { Loader2 } from 'lucide-react'
import { BookingWidget } from '@/features/booking/components/booking-widget'
import { ErrorState } from '@/components/patterns/error-state'
import {
  toBookingHost,
  toBookingTimeSlot,
} from '@/features/booking/lib/adapters'

import { z } from 'zod'

const hostSearchSchema = z.object({
  eventId: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/my/bookings/host/$personId')({
  component: HostPage,
  validateSearch: hostSearchSchema,
})

function ownerOf(value: string | Person): Person | null {
  return typeof value === 'string' ? null : value
}

function initials(person: Person | null | undefined): string {
  if (!person) return '?'
  return ((person.firstName?.[0] ?? '') + (person.lastName?.[0] ?? '') || '?').toUpperCase()
}

function HostPage() {
  const { personId } = Route.useParams()
  const { eventId } = Route.useSearch()
  const navigate = useNavigate()

  // Pull the host's active events. When eventId is provided (from host directory),
  // we pre-select that specific event instead of defaulting to the first one.
  const eventsQuery = useQuery({
    ...listBookingEventsOptions({
      query: { owner: personId, status: 'active', expand: 'owner', limit: 10 },
    }),
    staleTime: 60_000,
  })

  const events = eventsQuery.data?.data ?? []
  const event = (eventId ? events.find((e) => e.id === eventId) : events[0]) ?? events[0]

  // Fall back to a separate getPerson if expand didn't yield a person object
  // (e.g. if the host has no event at all, eventsQuery returns nothing).
  const expandedOwner = event ? ownerOf(event.owner) : null
  const personQuery = useQuery({
    ...getPersonOptions({ path: { person: personId } }),
    enabled: !expandedOwner,
    staleTime: 60_000,
  })

  const host = expandedOwner ?? personQuery.data ?? null

  // Slot range: from now to event.maxBookingDays out (default 30).
  const slotsQuery = useQuery({
    ...listEventSlotsOptions({ path: { event: event?.id ?? '' } }),
    enabled: !!event?.id,
    staleTime: 30_000,
  })

  const presentationSlots = useMemo(() => {
    if (!slotsQuery.data || !event) return []
    return slotsQuery.data.map((s) => toBookingTimeSlot(s, event))
  }, [slotsQuery.data, event])

  if (eventsQuery.isError || personQuery.isError) {
    return (
      <div className="p-6 max-w-2xl">
        <ErrorState
          message="Could not load host availability"
          onRetry={() => {
            eventsQuery.refetch()
            personQuery.refetch()
          }}
        />
      </div>
    )
  }

  if (eventsQuery.isPending || (!expandedOwner && personQuery.isPending)) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!host) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Host not found.</p>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl">
        <HostHeader host={host} />
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            This host doesn't have a public schedule yet.
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSlotSelect = (slot: { id: string }) => {
    navigate({
      to: '/my/bookings/host/$personId/$slotId',
      params: { personId, slotId: slot.id },
    })
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <HostHeader host={host} />
      <BookingWidget
        host={toBookingHost(host)}
        slots={presentationSlots}
        event={event}
        onSlotSelect={handleSlotSelect}
      />
    </div>
  )
}

function HostHeader({ host }: { host: Person }) {
  const name = [host.firstName, host.lastName].filter(Boolean).join(' ')
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={host.avatar?.url} />
          <AvatarFallback>{initials(host)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardTitle className="text-xl">{name}</CardTitle>
          <div className="mt-1 flex flex-wrap gap-1 text-sm text-muted-foreground">
            {host.primaryAddress?.city && <span>{host.primaryAddress.city}</span>}
            {host.languagesSpoken && host.languagesSpoken.length > 0 && (
              <Badge variant="secondary">{host.languagesSpoken.join(', ')}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
