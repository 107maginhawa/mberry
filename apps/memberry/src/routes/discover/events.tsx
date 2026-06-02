import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Input, PageContainer } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Calendar, MapPin, DollarSign, Award, Search } from 'lucide-react'
import { GlassCard } from '@/components/motion/glass-card'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { PageHeader } from '@/components/patterns/page-header'
import { EmptyState } from '@/components/patterns/empty-state'
import {
  listPublicEventsOptions,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

export const Route = createFileRoute('/discover/events')({
  component: DiscoverEvents,
})

function formatEventDate(startDate: string | Date) {
  return new Date(startDate).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatPrice(fee: number | bigint | null | undefined, currency?: string | null) {
  if (!fee || fee === 0 || fee === 0n) return 'Free'
  const amt = Number(fee) / 100
  return `${currency ?? 'PHP'} ${amt.toLocaleString()}`
}

function DiscoverEvents() {
  const [search, setSearch] = useState('')
  const [eventType, setEventType] = useState('all')
  const [pricing, setPricing] = useState('all')

  const { data, isLoading, error } = useQuery(
    listPublicEventsOptions({
      query: {
        q: search || undefined,
        eventType: eventType !== 'all' ? eventType : undefined,
        pricing: pricing !== 'all' ? pricing : undefined,
        limit: 24,
      } as any,
    })
  )

  const events = (data as any)?.data ?? []

  return (
    <PageContainer width="wide" className="space-y-6 py-6">
      <PageHeader
        title="Discover Events"
        subtitle="Public events across all organizations"
      />

      {/* Filter bar */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
              <Input
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="seminar">Seminar</SelectItem>
              <SelectItem value="social">Social</SelectItem>
              <SelectItem value="fundraiser">Fundraiser</SelectItem>
              <SelectItem value="governance">Governance</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select value={pricing} onValueChange={setPricing}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Pricing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      {/* Event grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <GlassCard key={i} className="p-4 space-y-3">
              <div className="h-32 rounded-lg bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
              <div className="h-5 w-3/4 rounded bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
              <div className="h-4 w-1/2 rounded bg-[var(--color-surface-elevated-hover)] animate-shimmer" />
            </GlassCard>
          ))}
        </div>
      ) : error ? (
        <GlassCard className="p-6">
          <EmptyState
            icon={<Calendar className="w-8 h-8" />}
            headline="Failed to load events"
            description="Something went wrong. Please try again."
          />
        </GlassCard>
      ) : events.length === 0 ? (
        <GlassCard className="p-6">
          <EmptyState
            icon={<Calendar className="w-8 h-8" />}
            headline="No public events found"
            description="Check back soon — organizations are always adding new events."
          />
        </GlassCard>
      ) : (
        <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event: any) => (
            <StaggerItem key={event.id}>
              <PublicEventCard event={event} />
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </PageContainer>
  )
}

function PublicEventCard({ event }: { event: any }) {
  const cpdHours = event.creditBearing && event.creditAmount > 0
    ? event.creditAmount
    : null

  return (
    <GlassCard className="overflow-hidden hover:shadow-lg transition-shadow">
      <Link to={`/events/${event.eventSlug ?? event.id}` as any}>
        {/* Cover image */}
        {event.coverImageUrl && (
          <div className="h-36 overflow-hidden">
            <img
              src={event.coverImageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-4 space-y-2">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-warm)] text-[var(--color-foreground)]">
              <DollarSign className="w-3 h-3" />
              {formatPrice(event.registrationFee, event.currency)}
            </span>
            {cpdHours && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary-bg)] text-[var(--color-primary)]">
                <Award className="w-3 h-3" />
                {cpdHours} CPD hrs
              </span>
            )}
          </div>

          <h3 className="text-h4 line-clamp-2">{event.title}</h3>

          <div className="space-y-1 text-body-sm text-[var(--color-muted)]">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{formatEventDate(event.startDate)}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </GlassCard>
  )
}
