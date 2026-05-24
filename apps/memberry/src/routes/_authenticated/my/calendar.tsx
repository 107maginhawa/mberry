import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/patterns/page-header'
import { EventCalendar } from '@/features/events/components/event-calendar'
import { listMyCustomEventsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { Calendar } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/my/calendar')({
  component: MyCalendar,
})

interface MyEventItem {
  id: string
  title: string
  status: string
  startDate: string
  endDate: string
  eventType?: string | null
  event?: {
    id: string
    title: string
    status: string
    startDate: string
    endDate: string
    eventType?: string | null
  }
}

function MyCalendar() {
  const { data, isLoading } = useQuery(listMyCustomEventsOptions())
  const rawEvents = (data?.data ?? []) as unknown as MyEventItem[]

  // Normalize — API may return event nested or flat
  const events = rawEvents.map(item => {
    const e = item.event ?? item
    return {
      id: e.id,
      title: e.title,
      status: e.status,
      startDate: e.startDate,
      endDate: e.endDate,
      eventType: e.eventType,
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Calendar"
        subtitle="Your registered events at a glance"
        breadcrumbs={[{ label: 'My Calendar' }]}
      />

      {isLoading ? (
        <div className="h-96 rounded-lg bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
      ) : events.length === 0 ? (
        <div className="border rounded-lg p-12 text-center space-y-2">
          <Calendar className="w-8 h-8 mx-auto text-[var(--color-muted)]" />
          <p className="text-[var(--color-muted)]">No events yet. Register for events to see them here.</p>
        </div>
      ) : (
        <EventCalendar events={events} linkBase="/my/events" />
      )}
    </div>
  )
}
