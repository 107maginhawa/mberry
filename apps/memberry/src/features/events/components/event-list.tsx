import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EventCard } from './event-card'
import { Calendar, Users, Clock } from 'lucide-react'

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

  const { data, isLoading } = useQuery({
    queryKey: ['events', orgId, tab, typeFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams(tabToApiParams(tab))
      if (typeFilter) params.set('type', typeFilter)
      if (search) params.set('search', search)
      params.set('limit', '50')
      const res = await fetch(`/api/events/list/${orgId}?${params}`)
      if (!res.ok) throw new Error('Failed to load events')
      return res.json() as Promise<{ data: any[]; meta: { total: number } }>
    },
  })

  const { data: statsData } = useQuery({
    queryKey: ['events-stats', orgId],
    queryFn: async () => {
      const [upcomingRes, draftRes] = await Promise.all([
        fetch(`/api/events/list/${orgId}?status=published&limit=1`),
        fetch(`/api/events/list/${orgId}?status=draft&limit=1`),
      ])
      const upcoming = await upcomingRes.json()
      const drafts = await draftRes.json()
      return {
        upcoming: upcoming.meta?.total ?? 0,
        drafts: drafts.meta?.total ?? 0,
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`/api/events/cancel/${eventId}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to cancel event')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', orgId] })
      queryClient.invalidateQueries({ queryKey: ['events-stats', orgId] })
    },
  })

  const events = filterEventsByTab(data?.data ?? [], tab)
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
                if (confirm('Cancel this event?')) cancelMutation.mutate(id)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
