import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Calendar, Search } from 'lucide-react'
import { EventCard } from '@/features/events/components/event-card'
import { GlassCard } from '@/components/motion/glass-card'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { PageShell } from '@/components/patterns/page-shell'
import { EmptyState } from '@/components/patterns/empty-state'
import {
  searchEventsOptions,
} from '@monobase/sdk-ts/generated/react-query'
import type { Event, EventStatus, EventType } from '@monobase/sdk-ts/generated/types.gen'
import type { ApiListResponse } from '@/types/api'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/events/')({
  component: OrgEvents,
})

const EVENT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'general_assembly', label: 'General Assembly' },
  { value: 'induction_ceremony', label: 'Induction' },
  { value: 'fellowship', label: 'Fellowship' },
  { value: 'medical_mission', label: 'Medical Mission' },
  { value: 'board_meeting', label: 'Board Meeting' },
  { value: 'committee_meeting', label: 'Committee Meeting' },
  { value: 'fundraiser', label: 'Fundraiser' },
  { value: 'other', label: 'Other' },
]

function OrgEvents() {
  const { orgId, orgSlug } = useOrg()
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery(
    searchEventsOptions({
      query: {
        organizationId: orgId,
        status: 'published' as EventStatus,
        eventType: (typeFilter !== 'all' ? typeFilter : undefined) as EventType | undefined,
        q: search || undefined,
        limit: 50,
      },
    }),
  )

  const events: Event[] = (data as unknown as ApiListResponse<Event>)?.data ?? []
  // Filter to upcoming only (start date >= now)
  const now = new Date()
  const upcoming = events.filter((e) => {
    const raw = e as unknown as { startDate?: string; start_date?: string }
    return new Date(raw.startDate ?? raw.start_date ?? 0) >= now
  })

  return (
    <PageShell
      title="Events"
      subtitle="Browse and register for upcoming events"
    >
      <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="Filter events by type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-muted)]" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Grid */}
      {isError ? (
        <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          Unable to load events. Please try refreshing the page.
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <GlassCard key={i} className="p-4 space-y-3">
              <div className="h-5 w-20 rounded-sm bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
              <div className="h-5 w-3/4 rounded-sm bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
              <div className="h-4 w-1/2 rounded-sm bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
              <div className="h-4 w-2/3 rounded-sm bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
            </GlassCard>
          ))}
        </div>
      ) : upcoming.length === 0 ? (
        <GlassCard className="p-6">
          <EmptyState
            icon={<Calendar className="w-8 h-8" />}
            headline={search || typeFilter !== 'all' ? 'No events match your filters' : 'No upcoming events'}
            description={search || typeFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Check back soon for new events!'}
          />
        </GlassCard>
      ) : (
        <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((event) => (
            <StaggerItem key={event.id}>
              <EventCard
                event={event}
                orgId={orgId}
                linkBase={`/org/${orgSlug}/events`}
              />
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
      </div>
    </PageShell>
  )
}
