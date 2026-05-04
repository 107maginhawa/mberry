import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { EventForm } from '@/features/events/components/event-form'
import { AttendanceView } from '@/features/events/components/attendance-view'
import { Calendar, MapPin, Users, Clock } from 'lucide-react'
import { api } from '@/lib/api'

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
  draft: 'bg-muted text-muted-foreground',
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

function RegistrationsTab({ eventId }: { eventId: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['registrations', eventId],
    queryFn: () => api.get(`/api/events/registrations/${eventId}`),
  })

  const registrations = data?.data ?? []

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-md" />
        ))}
      </div>
    )
  }

  if (registrations.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center text-muted-foreground">
        No registrations yet.
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3 font-medium">Member</th>
            <th className="text-left p-3 font-medium">Status</th>
            <th className="text-left p-3 font-medium">Registered At</th>
            <th className="text-left p-3 font-medium">Payment</th>
          </tr>
        </thead>
        <tbody>
          {registrations.map((reg: any) => (
            <tr key={reg.id} className="border-t hover:bg-muted/30">
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
              <td className="p-3 text-muted-foreground">
                {new Date(reg.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </td>
              <td className="p-3 text-muted-foreground">{reg.paymentStatus ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EventDetail() {
  const { orgId, eventId } = Route.useParams()
  const [tab, setTab] = useState<Tab>('details')
  const [editMode, setEditMode] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.get<{ data: any }>(`/api/events/detail/${eventId}`),
  })

  const event = data?.data

  return (
    <div className="space-y-6 p-6">
      <a href={`/org/${orgId}/officer/events`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to Events
      </a>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : error || !event ? (
        <div className="p-6 text-center text-destructive">Failed to load event</div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[event.status] ?? ''}`}>
                  {event.status}
                </span>
              </div>
              <h1 className="text-2xl font-bold">{event.title}</h1>
            </div>
            {!editMode && event.status !== 'cancelled' && (
              <button
                onClick={() => { setEditMode(true); setTab('details') }}
                className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted"
              >
                Edit
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setEditMode(false) }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                {t.key === 'registrations' && event.registrationCount != null && (
                  <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                    {event.registrationCount}
                  </span>
                )}
                {t.key === 'attendance' && event.attendance?.total != null && (
                  <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                    {event.attendance.total}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'details' && !editMode && (
            <div className="space-y-6 max-w-2xl">
              {event.description && (
                <p className="text-muted-foreground">{event.description}</p>
              )}
              <dl className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-xs text-muted-foreground mb-0.5">Start</dt>
                    <dd className="text-sm">{formatDate(event.startDate)}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-xs text-muted-foreground mb-0.5">End</dt>
                    <dd className="text-sm">{formatDate(event.endDate)}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-xs text-muted-foreground mb-0.5">Location</dt>
                    <dd className="text-sm">{event.location ?? 'TBA'}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-xs text-muted-foreground mb-0.5">Registration</dt>
                    <dd className="text-sm">
                      {event.registrationCount ?? 0}
                      {event.capacity ? ` / ${event.capacity}` : ''} registered
                      {event.registrationFee ? ` · PHP ${(event.registrationFee / 100).toFixed(2)} fee` : ' · Free'}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          )}

          {tab === 'details' && editMode && (
            <div className="max-w-3xl border rounded-lg p-6">
              <EventForm
                orgId={orgId}
                event={event}
                onSuccess={() => setEditMode(false)}
                onCancel={() => setEditMode(false)}
              />
            </div>
          )}

          {tab === 'registrations' && (
            <RegistrationsTab eventId={eventId} />
          )}

          {tab === 'attendance' && (
            <AttendanceView eventId={eventId} />
          )}
        </>
      )}
    </div>
  )
}
