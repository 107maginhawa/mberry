import { createFileRoute } from '@tanstack/react-router'
import { EventDetail } from '@/features/event-detail/EventDetail'

export const Route = createFileRoute('/events/$eventId')({ component: EventDetailPage })

function EventDetailPage() {
  const { eventId } = Route.useParams()
  return <EventDetail eventId={eventId} />
}
