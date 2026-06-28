import { createFileRoute, Link } from '@tanstack/react-router'
import { CreateEventForm } from '@/features/events/CreateEventForm'

export const Route = createFileRoute('/events')({ component: EventsPage })

function EventsPage() {
  return (
    <main className="mx-auto max-w-xl p-4">
      <Link to="/" className="mb-4 inline-flex min-h-[48px] items-center text-body font-medium text-primary underline">Back to dashboard</Link>
      <h1 className="mb-4 text-title font-semibold text-foreground">Events</h1>
      <CreateEventForm />
    </main>
  )
}
