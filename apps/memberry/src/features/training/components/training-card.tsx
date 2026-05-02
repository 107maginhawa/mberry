import { MoreHorizontal, Calendar, Users, Award, MapPin, Globe } from 'lucide-react'
import { useState } from 'react'

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
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="border rounded-xl bg-card overflow-hidden hover:shadow-md transition-shadow relative">
      {/* Cover / accent strip */}
      {training.coverImage ? (
        <img src={training.coverImage} alt="" className="w-full h-28 object-cover" />
      ) : (
        <div className="h-2 w-full bg-primary" />
      )}

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <a
              href={`/org/${orgId}/officer/training/${training.id}`}
              className="font-semibold text-sm line-clamp-2 hover:underline"
            >
              {training.title}
            </a>
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              aria-label="Actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-10 w-36 bg-popover border rounded-lg shadow-md py-1 text-sm">
                <a
                  href={`/org/${orgId}/officer/training/${training.id}`}
                  className="block px-3 py-1.5 hover:bg-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  Edit
                </a>
                {training.status !== 'cancelled' && (
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-muted text-destructive"
                    onClick={() => { setMenuOpen(false); onCancel?.(training.id) }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-muted"
                  onClick={() => { setMenuOpen(false); onDuplicate?.(training) }}
                >
                  Duplicate
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            {TYPE_LABELS[training.type] ?? training.type}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[training.status] ?? 'bg-gray-100 text-gray-700'}`}>
            {training.status.replace('_', ' ')}
          </span>
          {Number(training.creditValue) > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <Award className="w-3 h-3" />
              {training.creditValue} CPE
            </span>
          )}
        </div>

        {/* Meta */}
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{formatDate(training.startAt)}{training.endAt ? ` – ${formatDate(training.endAt)}` : ''}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {training.locationType === 'online' ? (
              <Globe className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <MapPin className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">
              {training.locationType === 'online'
                ? 'Online'
                : training.locationDetails?.venue ?? 'Venue TBA'}
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
