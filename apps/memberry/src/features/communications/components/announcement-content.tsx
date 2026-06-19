/**
 * AnnouncementContent — shared component for rendering announcement details.
 * Used by both officer detail page (with actions/stats) and member view (read-only).
 * VS-031: Wave 4b Communications.
 */

import { Link } from '@tanstack/react-router'
import { Button } from '@monobase/ui'
import { GlassCard } from '@/components/motion/glass-card'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnnouncementData {
  id: string
  title: string
  content: string
  status: string
  publishedAt: string | null
  createdAt: string
  channelPush: boolean
  channelEmail: boolean
  audienceType: string
  scheduledAt?: string | null
  visibility?: string
  stats?: {
    recipients: number
    emailSent: number
    pushDelivered: number
    inappViews: number
  }
}

export interface AnnouncementContentProps {
  announcement: AnnouncementData
  showActions?: boolean
  showStats?: boolean
  orgId?: string
  onPublish?: () => void
  onArchive?: () => void
  onDelete?: () => void
  publishPending?: boolean
  archivePending?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]',
  scheduled: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  sent: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  scheduled_failed: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  archived: 'bg-gray-100 text-gray-600',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnnouncementContent({
  announcement: ann,
  showActions = false,
  showStats = false,
  orgId,
  onPublish,
  onArchive,
  onDelete,
  publishPending = false,
  archivePending = false,
}: AnnouncementContentProps) {
  const statusLabel = ann.status.charAt(0).toUpperCase() + ann.status.slice(1).replace('_', ' ')

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex items-center gap-3 text-[14px] text-[var(--color-muted)]">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-medium ${STATUS_BADGE[ann.status] ?? ''}`}
        >
          {statusLabel}
        </span>
        <span>{ann.audienceType === 'all' ? 'All members' : 'Selected categories'}</span>
        {ann.channelPush && <span>Push</span>}
        {ann.channelEmail && <span>Email</span>}
      </div>

      {/* Content */}
      <GlassCard className="p-5">
        <h2 className="text-h4 mb-3">{ann.title}</h2>
        <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--color-text)]">
          {ann.content}
        </div>
      </GlassCard>

      {/* Metadata */}
      <GlassCard className="p-5">
        <div className="grid grid-cols-2 gap-4 text-[14px]">
          <div>
            <p className="text-[12px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">
              Created
            </p>
            <p>{formatDate(ann.createdAt)}</p>
          </div>
          <div>
            <p className="text-[12px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">
              Published
            </p>
            <p>{formatDate(ann.publishedAt)}</p>
          </div>
          {ann.scheduledAt && (
            <div>
              <p className="text-[12px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">
                Scheduled For
              </p>
              <p>{formatDate(ann.scheduledAt)}</p>
            </div>
          )}
          {ann.visibility && (
            <div>
              <p className="text-[12px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">
                Visibility
              </p>
              <p className="capitalize">{ann.visibility}</p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Delivery stats */}
      {showStats && ann.stats && (
        <GlassCard className="p-5">
          <h2 className="text-h4 mb-3">Delivery Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Recipients', value: ann.stats.recipients },
              { label: 'In-app Views', value: ann.stats.inappViews },
              { label: 'Push Delivered', value: ann.stats.pushDelivered },
              { label: 'Email Sent', value: ann.stats.emailSent },
            ].map((stat) => (
              <div key={stat.label} className="p-3 border rounded-sm text-center">
                <p className="text-[20px] font-bold">{stat.value}</p>
                <p className="text-[12px] text-[var(--color-muted)] mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Actions (officer view) */}
      {showActions && (
        <div className="flex gap-3 pt-2 border-t">
          {ann.status === 'draft' && onPublish && (
            <Button type="button" onClick={onPublish} disabled={publishPending}>
              {publishPending ? 'Publishing...' : 'Publish Now'}
            </Button>
          )}
          {ann.status === 'sent' && onPublish && (
            <Button type="button" variant="outline" onClick={onPublish} disabled={publishPending}>
              Resend
            </Button>
          )}
          {ann.status !== 'archived' && onArchive && (
            <Button
              type="button"
              variant="ghost"
              onClick={onArchive}
              disabled={archivePending}
            >
              {archivePending ? 'Archiving...' : 'Archive'}
            </Button>
          )}
          {ann.status === 'draft' && orgId && (
            <Link
              to={"/org/$orgSlug/officer/communications/new" as any}
              params={{ orgSlug: orgId } as any}
              search={{ edit: ann.id } as any}
              className="px-4 py-2 border rounded-sm text-[14px] font-medium hover:bg-[var(--color-surface-warm)]"
            >
              Edit
            </Link>
          )}
          {ann.status === 'draft' && onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
