import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@monobase/ui'
import { Calendar, Building2 } from 'lucide-react'
import { listMyCustomEventsOptions } from '@monobase/sdk-ts/generated/react-query'

export const Route = createFileRoute('/_authenticated/my/events')({
  component: MyEvents,
})

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  waitlisted: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
  pendingPayment: 'bg-orange-100 text-orange-800',
}

const EVENT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

function formatEventDate(startDate: string) {
  return new Date(startDate).toLocaleDateString('en-PH', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getLocation(event: any) {
  return event.location ?? 'In-person'
}

function isUpcoming(startDate: string) {
  return new Date(startDate) >= new Date()
}

function EventRegistrationCard({ item }: { item: { registration: any; event: any } }) {
  const { registration, event } = item
  const upcoming = isUpcoming(event.startDate)

  return (
    <div className={`border rounded-lg p-4 space-y-3 ${!upcoming ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_STATUS_COLORS[event.status] ?? ''}`}>
            {event.status}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[registration.status] ?? 'bg-muted text-muted-foreground'}`}>
            {registration.status}
          </span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {upcoming ? 'Upcoming' : 'Past'}
        </span>
      </div>

      <h3 className="font-semibold">{event.title}</h3>

      <div className="space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>{formatEventDate(event.startDate)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span>{getLocation(event)}</span>
        </div>
      </div>
    </div>
  )
}

function MyEvents() {
  const [showPast, setShowPast] = useState(false)

  const { data, isLoading, error } = useQuery(
    listMyCustomEventsOptions()
  )

  const allItems: Array<{ registration: any; event: any }> = (data as any)?.data ?? []
  const now = new Date()
  const upcoming = allItems.filter((item: any) => new Date(item.event.startDate) >= now)
  const past = allItems.filter((item: any) => new Date(item.event.startDate) < now)
  const displayed = showPast ? allItems : upcoming

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">My Events</h1>
        <p className="text-sm text-muted-foreground">Events you're registered for across all organizations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Upcoming</p>
          <p className="text-2xl font-bold">{isLoading ? '—' : upcoming.length}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Past</p>
          <p className="text-2xl font-bold">{isLoading ? '—' : past.length}</p>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex gap-1 border rounded-md p-1 w-fit">
        <button
          onClick={() => setShowPast(false)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            !showPast ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setShowPast(true)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            showPast ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 text-center text-destructive">Failed to load events</div>
      ) : displayed.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          {showPast ? 'No events found.' : 'No upcoming events. Check back soon!'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {displayed.map((item: any) => (
            <EventRegistrationCard key={item.registration.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
