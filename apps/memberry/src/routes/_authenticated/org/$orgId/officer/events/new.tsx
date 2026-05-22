import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { EventForm } from '@/features/events/components/event-form'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/events/new')({
  component: NewEvent,
})

function NewEvent() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Create Event"
        subtitle="Fill in the details for your new event"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Events', href: `/org/${orgId}/officer/events` },
          { label: 'New' },
        ]}
      />

      <GlassCard className="p-6">
        <EventForm
          orgId={orgId}
          onSuccess={(event) => {
            navigate({
              to: '/org/$orgId/officer/events/$eventId',
              params: { orgId, eventId: event.id },
            })
          }}
          onCancel={() => {
            navigate({
              to: '/org/$orgId/officer/events',
              params: { orgId },
            })
          }}
        />
      </GlassCard>
    </div>
  )
}
