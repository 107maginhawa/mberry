import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { EventForm } from '@/features/events/components/event-form'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/events/new')({
  component: NewEvent,
})

function NewEvent() {
  const { orgId, orgSlug } = useOrg()
  const navigate = useNavigate()

  return (
    <PageShell
      title="Create Event"
      subtitle="Fill in the details for your new event"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Events', href: `/org/${orgSlug}/officer/events` },
        { label: 'New' },
      ]}
    >
      <GlassCard className="p-6">
        <EventForm
          orgId={orgId}
          onSuccess={(event) => {
            navigate({
              to: '/org/$orgSlug/officer/events/$eventId',
              params: { orgSlug, eventId: event.id },
            })
          }}
          onCancel={() => {
            navigate({
              to: '/org/$orgSlug/officer/events',
              params: { orgSlug },
            })
          }}
        />
      </GlassCard>
    </PageShell>
  )
}
