import { MoreHorizontal, Calendar, Users, Award, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Button, MenuItem } from '@monobase/ui'

const TYPE_LABELS: Record<string, string> = {
  seminar: 'Seminar',
  workshop: 'Workshop',
  convention: 'Convention',
  online_course: 'Online Course',
  skills_training: 'Skills Training',
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface TrainingCardProps {
  training: any
  orgId: string
  onCancel?: (id: string) => void
  onDuplicate?: (training: any) => void
}

export function TrainingCard({ training, orgId, onCancel, onDuplicate }: TrainingCardProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="border rounded-xl bg-[var(--color-surface)] overflow-hidden hover:shadow-md transition-shadow relative">
      {/* Accent strip */}
      <div className="h-2 w-full bg-[var(--color-primary)]" />

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <a
              href={`/org/${orgSlug}/officer/training/${training.id}`}
              className="font-semibold text-sm line-clamp-2 hover:underline"
            >
              {training.title}
            </a>
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
              <div className="absolute right-0 top-7 z-10 w-36 bg-popover border rounded-lg shadow-md py-1 text-sm">
                <a
                  href={`/org/${orgSlug}/officer/training/${training.id}`}
                  className="block px-3 py-1.5 hover:bg-[var(--color-surface-warm)]"
                  onClick={() => setMenuOpen(false)}
                >
                  Edit
                </a>
                {training.status !== 'cancelled' && (
                  <MenuItem
                    destructive
                    onClick={() => { setMenuOpen(false); onCancel?.(training.id) }}
                  >
                    Cancel
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => { setMenuOpen(false); onDuplicate?.(training) }}
                >
                  Duplicate
                </MenuItem>
              </div>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-[var(--color-primary)]">
            {TYPE_LABELS[training.type] ?? training.type}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[training.status] ?? 'bg-gray-100 text-gray-700'}`}>
            {training.status.replace('_', ' ')}
          </span>
          {Number(training.creditAmount) > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <Award className="w-3 h-3" />
              {training.creditAmount} CPE
            </span>
          )}
        </div>

        {/* Meta */}
        <div className="space-y-1 text-xs text-[var(--color-muted)]">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{formatDate(training.startDate)}{training.endDate ? ` – ${formatDate(training.endDate)}` : ''}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {training.location ?? 'Venue TBA'}
            </span>
          </div>
          {(training.enrollmentCount ?? 0) > 0 && (
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>
                {training.enrollmentCount} enrolled
                {training.capacity ? ` / ${training.capacity}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
