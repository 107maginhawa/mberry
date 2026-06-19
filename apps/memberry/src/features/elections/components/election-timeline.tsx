import { CheckCircle2, Clock, Circle } from 'lucide-react'

interface ElectionTimelineProps {
  status: string
  nominationsOpenAt?: string | null
  nominationsCloseAt?: string | null
  votingOpenAt?: string | null
  votingCloseAt?: string | null
  publishedAt?: string | null
}

interface TimelineStep {
  label: string
  date?: string | null
  status: 'completed' | 'active' | 'upcoming'
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getSteps(props: ElectionTimelineProps): TimelineStep[] {
  const { status } = props
  const statusOrder = ['draft', 'nominationsOpen', 'votingOpen', 'awaitingConfirmation', 'published']
  const currentIdx = statusOrder.indexOf(status)
  const isCancelled = status === 'cancelled'

  return [
    {
      label: 'Draft',
      date: null,
      status: isCancelled ? 'completed' : currentIdx > 0 ? 'completed' : currentIdx === 0 ? 'active' : 'upcoming',
    },
    {
      label: 'Nominations Open',
      date: props.nominationsOpenAt,
      status: isCancelled ? 'completed' : currentIdx > 1 ? 'completed' : currentIdx === 1 ? 'active' : 'upcoming',
    },
    {
      label: 'Voting Open',
      date: props.votingOpenAt,
      status: isCancelled ? 'completed' : currentIdx > 2 ? 'completed' : currentIdx === 2 ? 'active' : 'upcoming',
    },
    {
      label: 'Awaiting Confirmation',
      date: props.votingCloseAt,
      status: isCancelled ? 'completed' : currentIdx > 3 ? 'completed' : currentIdx === 3 ? 'active' : 'upcoming',
    },
    {
      label: isCancelled ? 'Cancelled' : 'Results Published',
      date: isCancelled ? null : props.publishedAt,
      status: isCancelled ? 'active' : currentIdx >= 4 ? 'completed' : 'upcoming',
    },
  ]
}

export function ElectionTimeline(props: ElectionTimelineProps) {
  const steps = getSteps(props)

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-start flex-1 min-w-0">
          {/* Step indicator */}
          <div className="flex flex-col items-center">
            {step.status === 'completed' ? (
              <div className="w-7 h-7 rounded-full bg-[var(--color-success-bg)] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />
              </div>
            ) : step.status === 'active' ? (
              <div className="w-7 h-7 rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-white" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full border-2 border-[var(--color-muted)]/30 flex items-center justify-center shrink-0">
                <Circle className="w-3 h-3 text-[var(--color-muted)]/40" />
              </div>
            )}
            <div className="mt-2 text-center px-1">
              <p className={`text-xs font-medium leading-tight ${step.status === 'active' ? 'text-[var(--color-primary)]' : step.status === 'completed' ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)]'}`}>
                {step.label}
              </p>
              {step.date && (
                <p className="text-[10px] text-[var(--color-muted)] mt-0.5">{formatDate(step.date)}</p>
              )}
            </div>
          </div>
          {/* Connector line */}
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mt-3.5 mx-1 ${step.status === 'completed' ? 'bg-emerald-300' : 'bg-[var(--color-muted)]/20'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
