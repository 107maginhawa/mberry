import { useState } from 'react'
import { Button, ConfirmDialog, EmptyState, ErrorState, Skeleton, StatusBadge } from '@monobase/ui'
import type { OrgEvent } from './use-org-events'

const STATUS: Record<string, { label: string; variant: 'muted' | 'success' | 'error' }> = {
  draft: { label: 'Draft', variant: 'muted' },
  published: { label: 'Published', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'error' },
  completed: { label: 'Completed', variant: 'muted' },
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
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

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {events.map((e) => {
          const s = STATUS[e.status] ?? { label: e.status, variant: 'muted' as const }
          return (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-body font-medium text-foreground truncate">{e.title}</span>
                <span className="text-caption text-muted-foreground">{fmtDate(e.startDate)}</span>
              </div>
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
