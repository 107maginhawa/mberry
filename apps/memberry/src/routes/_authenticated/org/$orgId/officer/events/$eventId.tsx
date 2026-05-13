import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { TableSkeleton } from '@/components/patterns/skeleton-loader'
import { EventForm } from '@/features/events/components/event-form'
import { AttendanceView } from '@/features/events/components/attendance-view'
import { Calendar, MapPin, Users, Clock } from 'lucide-react'
import { getEventOptions, listCustomEventRegistrationsOptions } from '@monobase/sdk-ts/generated/react-query'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/events/$eventId')({
  component: EventDetail,
})

type Tab = 'details' | 'registrations' | 'attendance'

const TABS: { key: Tab; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'registrations', label: 'Registered' },
  { key: 'attendance', label: 'Check-in' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]',
  published: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  cancelled: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function RegistrationsTab({ eventId, orgId }: { eventId: string; orgId: string }) {
  const { data, isLoading } = useQuery(
    listCustomEventRegistrationsOptions({ path: { eventId }, headers: { 'x-org-id': orgId } })
  )

  const registrations = (data as any)?.data ?? []

  if (isLoading) {
    return <TableSkeleton rows={5} cols={4} />
  }

  if (registrations.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-8 h-8" />}
        headline="No registrations yet"
        description="Members who register for this event will appear here."
      />
    )
  }

  return (
    <GlassCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead className="bg-[var(--color-surface-warm)]/50">
            <tr>
              <th className="text-left p-3 font-medium">Member</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Registered At</th>
              <th className="text-left p-3 font-medium">Payment</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((reg: any) => (
              <tr key={reg.id} className="border-t border-[var(--color-border-light)] hover:bg-[var(--color-surface-warm)]/30">
                <td className="p-3 font-mono text-xs">{reg.personId}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    reg.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    reg.status === 'waitlisted' ? 'bg-yellow-100 text-yellow-800' :
                    reg.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {reg.status}
                  </span>
                </td>
                <td className="p-3 text-[var(--color-muted)]">
                  {new Date(reg.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="p-3 text-[var(--color-muted)]">{reg.paymentStatus ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}

function EventDetail() {
  const { orgId, eventId } = Route.useParams()
  const [tab, setTab] = useState<Tab>('details')
  const [editMode, setEditMode] = useState(false)

  const { data, isLoading, error } = useQuery(
    getEventOptions({ path: { eventId }, headers: { 'x-org-id': orgId } })
  )

  const event = (data as any)?.data ?? data

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="space-y-3">
          <TableSkeleton rows={3} cols={1} />
        </div>
      ) : error || !event ? (
        <div className="p-6 text-center text-[var(--color-error)]">Failed to load event</div>
      ) : (
        <>
          {/* Header */}
          <PageHeader
            title={event.title}
            breadcrumbs={[
              { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
              { label: 'Events', href: `/org/${orgId}/officer/events` },
              { label: event.title },
            ]}
            actions={
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[event.status] ?? ''}`}>
                  {event.status}
                </span>
                {!editMode && event.status !== 'cancelled' && (
                  <button
                    onClick={() => { setEditMode(true); setTab('details') }}
                    className="px-4 py-2 border border-[var(--color-border-light)] rounded-[8px] text-[14px] font-medium hover:bg-[var(--color-surface-warm)]"
                  >
                    Edit
                  </button>
                )}
              </div>
            }
          />

          {/* Tabs */}
          <div className="flex gap-1 border-b border-[var(--color-border-light)]">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setEditMode(false) }}
                className={`px-4 py-2.5 text-[14px] font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.key
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {t.label}
                {t.key === 'registrations' && event.registrationCount != null && (
                  <span className="ml-1.5 text-xs bg-[var(--color-surface-warm)] rounded-full px-1.5 py-0.5">
                    {event.registrationCount}
                  </span>
                )}
                {t.key === 'attendance' && event.attendance?.total != null && (
                  <span className="ml-1.5 text-xs bg-[var(--color-surface-warm)] rounded-full px-1.5 py-0.5">
                    {event.attendance.total}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'details' && !editMode && (
            <GlassCard className="p-6">
              <div className="space-y-6 max-w-2xl">
                {event.description && (
                  <p className="text-[var(--color-muted)]">{event.description}</p>
                )}
                <dl className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                    <div>
                      <dt className="text-xs text-[var(--color-muted)] mb-0.5">Start</dt>
                      <dd className="text-[14px]">{formatDate(event.startDate)}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                    <div>
                      <dt className="text-xs text-[var(--color-muted)] mb-0.5">End</dt>
                      <dd className="text-[14px]">{formatDate(event.endDate)}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                    <div>
                      <dt className="text-xs text-[var(--color-muted)] mb-0.5">Location</dt>
                      <dd className="text-[14px]">{event.location ?? 'TBA'}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                    <div>
                      <dt className="text-xs text-[var(--color-muted)] mb-0.5">Registration</dt>
                      <dd className="text-[14px]">
                        {event.registrationCount ?? 0}
                        {event.capacity ? ` / ${event.capacity}` : ''} registered
                        {event.registrationFee ? ` · PHP ${(Number(event.registrationFee) / 100).toFixed(2)} fee` : ' · Free'}
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>
            </GlassCard>
          )}

          {tab === 'details' && editMode && (
            <GlassCard className="p-6 max-w-3xl">
              <EventForm
                orgId={orgId}
                event={event}
                onSuccess={() => setEditMode(false)}
                onCancel={() => setEditMode(false)}
              />
            </GlassCard>
          )}

          {tab === 'registrations' && (
            <RegistrationsTab eventId={eventId} orgId={orgId} />
          )}

          {tab === 'attendance' && (
            <AttendanceView eventId={eventId} />
          )}
        </>
      )}
    </div>
  )
}
