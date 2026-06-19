import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { PageShell } from '@/components/patterns/page-shell'
import { EmptyState } from '@/components/patterns/empty-state'
import { EventCalendar } from '@/features/events/components/event-calendar'
import { listMyCustomEventsOptions } from '@monobase/sdk-ts/generated/react-query'
import { Skeleton } from '@monobase/ui'
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
    <PageShell
      title="My Calendar"
      subtitle="Your registered events at a glance"
      breadcrumbs={[{ label: 'My Calendar' }]}
    >
      <div className="space-y-6">
      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-8 h-8" />}
          headline="No events yet"
          description="Register for events to see them here."
        />
      ) : (
        <EventCalendar events={events} linkBase="/my/events" />
      )}
      </div>
    </PageShell>
  )
}
