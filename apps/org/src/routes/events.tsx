import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CreateEventForm } from '@/features/events/CreateEventForm'
import { EventsList } from '@/features/events/EventsList'
import { useOrgEvents } from '@/features/events/use-org-events'
import { usePublishEvent } from '@/features/events/use-publish-event'
import { useSelectedOrg } from '@/features/org/use-org'

export const Route = createFileRoute('/events')({ component: EventsPage })

export function EventsPage() {
  const { orgId } = useSelectedOrg()
  const qc = useQueryClient()
  const { status, events } = useOrgEvents(orgId)
  const { publish, publishingId } = usePublishEvent(orgId)

  return (
    <main className="mx-auto max-w-xl p-4 flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h1 className="text-title font-semibold text-foreground">Events</h1>
        <EventsList status={status} events={events} onPublish={publish} publishingId={publishingId} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Create a new event</h2>
        <CreateEventForm onCreated={() => qc.invalidateQueries({ queryKey: ['org-events', orgId] })} />
      </section>
    </main>
  )
}
