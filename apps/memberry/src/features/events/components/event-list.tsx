import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EventCard } from './event-card'
import { Calendar, Users, Clock } from 'lucide-react'
import {
  searchEventsOptions,
  searchEventsQueryKey,
  cancelEventMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

interface EventListProps {
  orgId: string
}

type StatusTab = 'upcoming' | 'past' | 'drafts' | 'cancelled'

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'cancelled', label: 'Cancelled' },
]

const EVENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'general_assembly', label: 'General Assembly' },
  { value: 'induction_ceremony', label: 'Induction' },
  { value: 'fellowship', label: 'Fellowship' },
  { value: 'medical_mission', label: 'Medical Mission' },
  { value: 'board_meeting', label: 'Board Meeting' },
  { value: 'committee_meeting', label: 'Committee Meeting' },
  { value: 'fundraiser', label: 'Fundraiser' },
  { value: 'other', label: 'Other' },
]

function tabToApiParams(tab: StatusTab): Record<string, string> {
  switch (tab) {
    case 'upcoming': return { status: 'published' }
    case 'past': return { status: 'published,completed' }
    case 'drafts': return { status: 'draft' }
    case 'cancelled': return { status: 'cancelled' }
  }
}

function filterEventsByTab(events: any[], tab: StatusTab): any[] {
  const now = new Date()
  if (tab === 'upcoming') return events.filter(e => new Date(e.startDate || e.start_date) >= now)
  if (tab === 'past') return events.filter(e => new Date(e.startDate || e.start_date) < now)
  return events
}

export function EventList({ orgId }: EventListProps) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<StatusTab>('upcoming')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')

  const tabParams = tabToApiParams(tab)
  const { data, isLoading } = useQuery(
    searchEventsOptions({
      query: {
        organizationId: orgId,
        status: tabParams.status as any,
        eventType: typeFilter as any || undefined,
        q: search || undefined,
        limit: 50,
      },
    }),
  )

  const { data: upcomingData } = useQuery(
    searchEventsOptions({ query: { organizationId: orgId, status: 'published' as any, limit: 1 } }),
  )
  const { data: draftsData } = useQuery(
    searchEventsOptions({ query: { organizationId: orgId, status: 'draft' as any, limit: 1 } }),
  )
  const statsData = {
    upcoming: upcomingData?.pagination?.totalCount ?? 0,
    drafts: draftsData?.pagination?.totalCount ?? 0,
  }

  const doCancel = useMutation({
    ...cancelEventMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: searchEventsQueryKey({ query: { organizationId: orgId } }) })
    },
  })

  const events = filterEventsByTab((data?.data ?? []) as any[], tab)
  const total = events.length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="w-4 h-4" />
            <p className="text-sm">Upcoming</p>
          </div>
          <p className="text-2xl font-bold">{statsData?.upcoming ?? '—'}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            <p className="text-sm">Drafts</p>
          </div>
          <p className="text-2xl font-bold">{statsData?.drafts ?? '—'}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <p className="text-sm">Showing</p>
          </div>
          <p className="text-2xl font-bold">{total}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 border rounded-md p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <Input
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-56 h-9"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          {search || typeFilter
            ? 'No events match your filters.'
            : tab === 'drafts'
            ? 'No drafts. Create a new event to get started.'
            : `No ${tab} events.`}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event: any) => (
            <EventCard
              key={event.id}
              event={event}
              orgId={orgId}
              onCancel={(id) => {
                if (confirm('Cancel this event?')) doCancel.mutate({ path: { eventId: id } })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
