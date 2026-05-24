import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { DataTable } from '@/components/patterns/data-table'
import { TableSkeleton } from '@/components/patterns/skeleton-loader'
import { EventForm } from '@/features/events/components/event-form'
import { AttendanceView } from '@/features/events/components/attendance-view'
import { Calendar, MapPin, Users, Clock } from 'lucide-react'
import { Button } from '@monobase/ui'
import { getEventOptions, listCustomEventRegistrationsOptions } from '@monobase/sdk-ts/generated/react-query'
import { useOrg } from '@/hooks/useOrg'

/** Runtime event shape from API (SDK Event type has Date fields; runtime uses string dates + extra fields) */
interface RuntimeEvent {
  id: string
  title: string
  status: string
  eventType?: string | null
  description?: string | null
  startDate: string
  endDate: string
  location?: string | null
  registrationFee?: number | null
  capacity?: number | null
  visibility?: string | null
  registrationCount?: number | null
  attendance?: { total?: number } | null
}

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/events/$eventId')({
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

interface Registration {
  id: string
  personId?: string
  memberName?: string
  personName?: string
  email?: string
  status: string
  createdAt: string
  paymentStatus?: string | null
}

const REG_STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  waitlisted: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  cancelled: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  pending: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
}

const registrationColumns: ColumnDef<Registration, unknown>[] = [
  {
    accessorKey: 'memberName',
    header: 'Member',
    cell: ({ row }) => {
      const name = row.original.memberName ?? row.original.personName ?? row.original.personId
      return (
        <div>
          <p className="font-medium text-sm">{name}</p>
          {row.original.email && (
            <p className="text-xs text-[var(--color-muted)]">{row.original.email}</p>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => {
      const status = getValue<string>()
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          REG_STATUS_STYLES[status] ?? 'bg-[var(--color-border-light)] text-[var(--color-muted)]'
        }`}>
          {status}
        </span>
      )
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Registered',
    cell: ({ getValue }) =>
      new Date(getValue<string>()).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
  },
  {
    accessorKey: 'paymentStatus',
    header: 'Payment',
    cell: ({ getValue }) => getValue<string>() ?? '—',
  },
]

function RegistrationsTab({ eventId, orgId }: { eventId: string; orgId: string }) {
  const { data, isLoading } = useQuery(
    listCustomEventRegistrationsOptions({ path: { eventId }, headers: { 'x-org-id': orgId } })
  )

  const registrations = (data?.data ?? []) as unknown as Registration[]

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
      <DataTable
        columns={registrationColumns}
        data={registrations}
        pageSize={25}
        renderMobileCard={(reg) => (
          <div className="px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">
                {reg.memberName ?? reg.personName ?? reg.personId}
              </p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                REG_STATUS_STYLES[reg.status] ?? 'bg-[var(--color-border-light)] text-[var(--color-muted)]'
              }`}>
                {reg.status}
              </span>
            </div>
            {reg.email && (
              <p className="text-xs text-[var(--color-muted)]">{reg.email}</p>
            )}
            <p className="text-xs text-[var(--color-muted)]">
              {new Date(reg.createdAt).toLocaleDateString('en-PH', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
              {reg.paymentStatus ? ` · ${reg.paymentStatus}` : ''}
            </p>
          </div>
        )}
      />
    </GlassCard>
  )
}

function EventDetail() {
  const { orgId, orgSlug } = useOrg()
  const { eventId } = Route.useParams()
  const [tab, setTab] = useState<Tab>('details')
  const [editMode, setEditMode] = useState(false)

  const { data, isLoading, error } = useQuery(
    getEventOptions({ path: { eventId }, headers: { 'x-org-id': orgId } })
  )

  // SDK Event type has Date fields; runtime response uses string dates + extra fields — use local RuntimeEvent
  const event = data as unknown as RuntimeEvent | undefined

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
              { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
              { label: 'Events', href: `/org/${orgSlug}/officer/events` },
              { label: event.title },
            ]}
            actions={
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[event.status] ?? ''}`}>
                  {event.status}
                </span>
                {!editMode && event.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    onClick={() => { setEditMode(true); setTab('details') }}
                  >
                    Edit
                  </Button>
                )}
              </div>
            }
          />

          {/* Tabs */}
          <div className="flex gap-1 border-b border-[var(--color-border-light)]">
            {TABS.map((t) => (
              <Button
                key={t.key}
                variant="ghost"
                onClick={() => { setTab(t.key); setEditMode(false) }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px rounded-none ${
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
              </Button>
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
                      <dd className="text-sm">{formatDate(event.startDate)}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                    <div>
                      <dt className="text-xs text-[var(--color-muted)] mb-0.5">End</dt>
                      <dd className="text-sm">{formatDate(event.endDate)}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                    <div>
                      <dt className="text-xs text-[var(--color-muted)] mb-0.5">Location</dt>
                      <dd className="text-sm">{event.location ?? 'TBA'}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                    <div>
                      <dt className="text-xs text-[var(--color-muted)] mb-0.5">Registration</dt>
                      <dd className="text-sm">
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
