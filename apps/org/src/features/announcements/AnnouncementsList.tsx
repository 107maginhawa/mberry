import {
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge,
  type StatusBadgeVariant,
} from '@monobase/ui'
import { useSelectedOrg } from '@/features/org/use-org'
import { useListAnnouncements, type AnnouncementListItem } from './use-list-announcements'

// Map the announcement lifecycle status to a badge variant + friendly label —
// never leak the raw enum (DESIGN.md). Anchored to the real SDK status union.
function statusVariant(status: AnnouncementListItem['status']): StatusBadgeVariant {
  if (status === 'sent') return 'success'
  if (status === 'scheduled') return 'info'
  if (status === 'scheduledFailed') return 'error'
  return 'muted' // draft, archived
}

const STATUS_LABEL: Record<AnnouncementListItem['status'], string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sent: 'Sent',
  scheduledFailed: 'Failed',
  archived: 'Archived',
}

function formatDate(date: string | Date): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function AnnouncementsList() {
  const { orgId } = useSelectedOrg()
  const { status, announcements, refetch } = useListAnnouncements(orgId)

  return (
    <section aria-label="Posted announcements" className="mt-6">
      <h2 className="mb-3 text-section font-semibold text-foreground">Posted announcements</h2>

      {status === 'loading' && (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading announcements">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {status === 'error' && (
        <ErrorState message="We couldn't load announcements." onRetry={refetch} />
      )}

      {status === 'empty' && (
        <EmptyState
          headline="No announcements yet"
          description="Announcements you post will appear here."
        />
      )}

      {status === 'ready' && (
        <ul className="flex flex-col gap-3">
          {announcements.map((a) => {
            const dateText = formatDate(a.date)
            return (
              <li
                key={a.id}
                className="flex flex-col gap-2 rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-body font-medium text-foreground">{a.title}</span>
                  <StatusBadge variant={statusVariant(a.status)}>{STATUS_LABEL[a.status]}</StatusBadge>
                </div>
                {a.content && (
                  <p className="text-body text-muted-foreground whitespace-pre-wrap break-words">{a.content}</p>
                )}
                {dateText && <span className="text-caption text-muted-foreground">{dateText}</span>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
