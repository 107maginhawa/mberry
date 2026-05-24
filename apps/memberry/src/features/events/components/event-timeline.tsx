import { FileEdit, Globe, CalendarCheck, CheckCircle2, XCircle } from 'lucide-react'

type EventLifecycleStage = 'draft' | 'published' | 'event_day' | 'completed' | 'cancelled'

interface EventTimelineProps {
  status: string
  startDate: string | Date
  endDate: string | Date
}

const STAGES: { key: EventLifecycleStage; label: string; icon: React.ReactNode }[] = [
  { key: 'draft', label: 'Draft', icon: <FileEdit className="w-4 h-4" /> },
  { key: 'published', label: 'Published', icon: <Globe className="w-4 h-4" /> },
  { key: 'event_day', label: 'Event Day', icon: <CalendarCheck className="w-4 h-4" /> },
  { key: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-4 h-4" /> },
]

function getCurrentStage(status: string, startDate: Date, endDate: Date): EventLifecycleStage {
  if (status === 'cancelled') return 'cancelled'
  if (status === 'completed') return 'completed'
  const now = new Date()
  if (now >= startDate && now <= endDate) return 'event_day'
  if (status === 'published' || status === 'registration_open') return 'published'
  return 'draft'
}

function getStageIndex(stage: EventLifecycleStage): number {
  return STAGES.findIndex(s => s.key === stage)
}

export function EventTimeline({ status, startDate, endDate }: EventTimelineProps) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const currentStage = getCurrentStage(status, start, end)

  if (currentStage === 'cancelled') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)]">
        <XCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Event Cancelled</span>
      </div>
    )
  }

  const currentIndex = getStageIndex(currentStage)

  return (
    <div className="flex items-center gap-0" role="list" aria-label="Event lifecycle">
      {STAGES.map((stage, i) => {
        const isPast = i < currentIndex
        const isCurrent = i === currentIndex
        const isFuture = i > currentIndex

        return (
          <div key={stage.key} className="flex items-center" role="listitem">
            {/* Stage node */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                  isCurrent
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                    : isPast
                    ? 'border-[var(--color-success)] bg-[var(--color-success-bg)] text-[var(--color-success)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)]'
                }`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {stage.icon}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                isCurrent ? 'text-[var(--color-primary)]' : isPast ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)]'
              }`}>
                {stage.label}
              </span>
            </div>

            {/* Connector line */}
            {i < STAGES.length - 1 && (
              <div className={`w-8 sm:w-12 h-0.5 mx-1 mt-[-16px] ${
                i < currentIndex ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
