import { useState } from 'react'
import { Button } from '@monobase/ui'
import { Calendar, MapPin, Users, MoreHorizontal } from 'lucide-react'
import { Link, useParams } from '@tanstack/react-router'
import { GlassCard } from '@/components/motion/glass-card'

interface EventCardProps {
  event: {
    id: string
    title: string
    status: string
    startDate: string | Date
    endDate: string | Date
    location?: string | null
    registrationCount?: number
    capacity?: number | null
  }
  orgId: string
  onEdit?: (id: string) => void
  onCancel?: (id: string) => void
  onDuplicate?: (id: string) => void
  linkBase?: string
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]',
  published: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  cancelled: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
}

function formatEventDate(startDate: string | Date, endDate: string | Date) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const dateStr = start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  const startTime = start.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  const endTime = end.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} · ${startTime}–${endTime}`
}

function getLocation(event: EventCardProps['event']) {
  return event.location ?? 'In-person'
}

export function EventCard({ event, orgId, onEdit, onCancel, onDuplicate, linkBase }: EventCardProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <GlassCard className="overflow-hidden">
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[event.status] ?? 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]'}`}>
              {event.status}
            </span>
          </div>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Actions"
            >
              <MoreHorizontal className="w-4 h-4 text-[var(--color-muted)]" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-10 w-36 border border-[var(--color-surface-border-glass)] rounded-[8px] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] shadow-[var(--shadow-soft)] text-body-sm">
                <a
                  href={`${linkBase ?? `/org/${orgSlug}/officer/events`}/${event.id}`}
                  className="block px-3 py-2 hover:bg-[var(--color-surface-elevated-hover)] rounded-t-[8px]"
                  onClick={() => setMenuOpen(false)}
                >
                  View Details
                </a>
                {onEdit && (
                  <Button
                    variant="ghost"
                    onClick={() => { onEdit(event.id); setMenuOpen(false) }}
                    className="w-full justify-start px-3 py-2"
                  >
                    Edit
                  </Button>
                )}
                {onDuplicate && (
                  <Button
                    variant="ghost"
                    onClick={() => { onDuplicate(event.id); setMenuOpen(false) }}
                    className="w-full justify-start px-3 py-2"
                  >
                    Duplicate
                  </Button>
                )}
                {onCancel && event.status !== 'cancelled' && (
                  <Button
                    variant="ghost"
                    onClick={() => { onCancel(event.id); setMenuOpen(false) }}
                    className="w-full justify-start px-3 py-2 text-[var(--color-error)]"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <Link
          to={`${linkBase ?? `/org/${orgSlug}/officer/events`}/${event.id}` as any /* eslint-disable-line @typescript-eslint/no-explicit-any */} className="block">
          <h3 className="text-h4 leading-snug hover:text-[var(--color-primary)] transition-colors line-clamp-2">
            {event.title}
          </h3>
        </Link>

        {/* Meta */}
        <div className="space-y-1.5 text-body-sm text-[var(--color-muted)]">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{formatEventDate(event.startDate, event.endDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{getLocation(event)}</span>
          </div>
          {typeof event.registrationCount === 'number' && (
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>
                {event.registrationCount}
                {event.capacity ? ` / ${event.capacity}` : ''} registered
              </span>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  )
}
