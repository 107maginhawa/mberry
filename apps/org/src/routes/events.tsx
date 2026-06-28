import { createFileRoute } from '@tanstack/react-router'
import { CreateEventForm } from '@/features/events/CreateEventForm'

export const Route = createFileRoute('/events')({ component: EventsPage })

function EventsPage() {
  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-title font-semibold text-foreground">Events</h1>
      <CreateEventForm />
    </main>
  )
}
