import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

interface ActionWidgetProps {
  icon: ReactNode
  label: string
  value: string | number
  subtitle?: string
  status?: 'success' | 'warning' | 'error' | 'neutral'
  statusLabel?: string
  action?: { label: string; to: string; params?: Record<string, string> }
  errorMessage?: string
  children?: ReactNode
}

const statusDot: Record<string, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  neutral: 'bg-gray-400',
}

const statusDefaults: Record<string, string> = {
  success: 'Good standing',
  warning: 'Needs attention',
  error: 'Action needed',
  neutral: 'No data',
}

export function ActionWidget({ icon, label, value, subtitle, status, statusLabel, action, errorMessage, children }: ActionWidgetProps) {
  if (errorMessage) {
    return (
      <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 flex flex-col justify-between min-h-[130px]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400" aria-hidden="true">{icon}</span>
            <p className="text-[12px] font-medium text-red-400 uppercase tracking-wide">{label}</p>
          </div>
          <p className="text-[13px] font-medium text-red-600">{errorMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4 flex flex-col justify-between min-h-[130px]">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[var(--color-muted)]" aria-hidden="true">{icon}</span>
          <p className="text-[12px] font-medium text-[var(--color-muted)] uppercase tracking-wide">{label}</p>
          {status && (
            <>
              <span
                className={`ml-auto w-2 h-2 rounded-full ${statusDot[status]}`}
                role="img"
                aria-label={statusLabel ?? statusDefaults[status]}
              />
              <span className="sr-only">{statusLabel ?? statusDefaults[status]}</span>
            </>
          )}
        </div>
        {children ?? (
          <>
            <p className="text-[24px] font-bold font-display leading-tight text-[var(--color-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </p>
            {subtitle && (
              <p className="text-[12px] font-medium text-[var(--color-muted)] mt-0.5">{subtitle}</p>
            )}
          </>
        )}
      </div>
      {action && (
        <Link
          to={action.to}
          params={action.params ?? {}}
          className="mt-3 inline-flex items-center text-[12px] font-semibold text-[var(--color-primary)] hover:underline"
        >
          {action.label} &rarr;
        </Link>
      )}
    </div>
  )
}

interface CreditRingProps {
  earned: number
  required: number
  size?: number
}

export function CreditRing({ earned, required, size = 52 }: CreditRingProps) {
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = required > 0 ? Math.min(earned / required, 1) : (earned > 0 ? 1 : 0)
  const dashOffset = circumference * (1 - progress)

  const color = progress >= 1 ? 'var(--color-success, #10b981)' : progress >= 0.6 ? 'var(--color-primary)' : 'var(--color-error, #ef4444)'

  return (
    <svg
      width={size}
      height={size}
      className="shrink-0 -rotate-90"
      role="img"
      aria-label={`${earned} of ${required > 0 ? required : earned} credits earned`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-border-light)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  )
}
