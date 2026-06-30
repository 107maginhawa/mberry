import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, ConfirmDialog, EmptyState, ErrorState, Skeleton, StatusBadge, ToggleGroup, ToggleGroupItem, centavosToPhp } from '@monobase/ui'
import type { OrgEvent } from './use-org-events'

type EventFilter = 'upcoming' | 'past' | 'drafts'
const FILTERS: { value: EventFilter; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'drafts', label: 'Drafts' },
]

// Past = the event has ended (end, or start when no end, is before now). Drafts are their own bucket.
function isPast(e: OrgEvent): boolean {
  const t = new Date((e.endDate ?? e.startDate) as string).getTime()
  return !Number.isNaN(t) && t < Date.now()
}
function inFilter(e: OrgEvent, f: EventFilter): boolean {
  if (f === 'drafts') return e.status === 'draft'
  if (f === 'past') return e.status !== 'draft' && isPast(e)
  return e.status !== 'draft' && !isPast(e) // upcoming
}

// One present-facts line: date · fee/Free · N going (+ waitlist when any).
function metaLine(e: OrgEvent): string {
  const parts = [fmtDate(e.startDate), e.registrationFee ? centavosToPhp(e.registrationFee) : 'Free', `${e.registeredCount} going`]
  if (e.waitlistCount > 0) parts.push(`${e.waitlistCount} waitlist`)
  return parts.join(' · ')
}

const STATUS: Record<string, { label: string; variant: 'muted' | 'success' | 'error' }> = {
  draft: { label: 'Draft', variant: 'muted' },
  published: { label: 'Published', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'error' },
  completed: { label: 'Completed', variant: 'muted' },
}

// Short on the list (e.g. "14 Mar") so the meta line keeps room for the fee + going count;
// the full date+time lives on the event detail.
function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-PH', { day: 'numeric', month: 'short' })
}

export function EventsList({
  events,
  status,
  onPublish,
  publishingId,
  onRetry,
}: {
  events: OrgEvent[]
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error'
  onPublish: (id: string) => void
  publishingId: string | null
  onRetry?: () => void
}) {
  const [ask, setAsk] = useState<OrgEvent | null>(null)
  const [filter, setFilter] = useState<EventFilter>('upcoming')

  if (status === 'loading') {
    return (
      <div role="status" aria-live="polite" aria-label="Loading events" className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }
  if (status === 'error') {
    return (
      <ErrorState
        message="We couldn't load events. You may need officer or admin access."
        onRetry={onRetry}
      />
    )
  }
  if (status === 'empty' || status === 'idle') {
    return <EmptyState headline="No events yet" description="Create one below and publish it when you’re ready." />
  }

  const visible = events.filter((e) => inFilter(e, filter))

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        value={filter}
        onValueChange={(v) => { if (v) setFilter(v as EventFilter) }}
        className="flex-wrap justify-start gap-2"
        aria-label="Filter events"
      >
        {FILTERS.map((f) => (
          <ToggleGroupItem key={f.value} value={f.value} className="min-h-tap px-4">{f.label}</ToggleGroupItem>
        ))}
      </ToggleGroup>

      {visible.length === 0 ? (
        <p className="text-body text-muted-foreground">No {filter} events.</p>
      ) : (
      <ul className="flex flex-col gap-3">
        {visible.map((e) => {
          const s = STATUS[e.status] ?? { label: e.status, variant: 'muted' as const }
          return (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
            >
              <Link
                to="/events/$eventId"
                params={{ eventId: e.id }}
                className="flex flex-col gap-1 min-w-0"
                aria-label={`Open ${e.title}`}
              >
                <span className="text-body font-medium text-foreground truncate">{e.title}</span>
                <span className="text-caption text-muted-foreground truncate">{metaLine(e)}</span>
              </Link>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge variant={s.variant}>{s.label}</StatusBadge>
                {e.status === 'draft' && (
                  <Button
                    className="min-h-tap"
                    disabled={publishingId !== null}
                    onClick={() => setAsk(e)}
                    aria-label={`Publish ${e.title}`}
                  >
                    {publishingId === e.id ? 'Publishing…' : 'Publish'}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      )}
      {ask && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setAsk(null) }}
          title={`Publish ${ask.title}?`}
          description="Members will see this event and can register. You can’t unpublish it here."
          confirmLabel="Publish"
          onConfirm={() => { onPublish(ask.id); setAsk(null) }}
        />
      )}
    </div>
  )
}
