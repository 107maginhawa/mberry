import type { ComponentType } from 'react'
import {
  FileText,
  Send,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MinusCircle,
  Clock,
  RotateCcw,
  Timer,
} from 'lucide-react'

interface StatusConfig {
  label: string
  className: string
  icon: ComponentType<{ className?: string }>
}

const INVOICE_STATUS_CONFIG: Record<string, StatusConfig> = {
  generated: {
    label: 'Generated',
    className: 'bg-gray-100 text-gray-700',
    icon: FileText,
  },
  sent: {
    label: 'Sent',
    className: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
    icon: Send,
  },
  overdue: {
    label: 'Overdue',
    className: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
    icon: AlertTriangle,
  },
  paid: {
    label: 'Paid',
    className: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    icon: CheckCircle,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-500',
    icon: XCircle,
  },
  writtenOff: {
    label: 'Written Off',
    className: 'bg-gray-100 text-gray-500',
    icon: MinusCircle,
  },
}

const PAYMENT_STATUS_CONFIG: Record<string, StatusConfig> = {
  pending: {
    label: 'Pending',
    className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
    icon: Clock,
  },
  submitted: {
    label: 'Submitted',
    className: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
    icon: Send,
  },
  underReview: {
    label: 'Under Review',
    className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
    icon: Clock,
  },
  confirmed: {
    label: 'Confirmed',
    className: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    icon: CheckCircle,
  },
  completed: {
    label: 'Completed',
    className: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    className: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
    icon: XCircle,
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
    icon: XCircle,
  },
  refunded: {
    label: 'Refunded',
    className: 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]',
    icon: RotateCcw,
  },
  partiallyRefunded: {
    label: 'Partially Refunded',
    className: 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]',
    icon: RotateCcw,
  },
  expired: {
    label: 'Expired',
    className: 'bg-gray-100 text-gray-500',
    icon: Timer,
  },
}

const FALLBACK: StatusConfig = {
  label: 'Unknown',
  className: 'bg-gray-100 text-gray-600',
  icon: FileText,
}

interface DuesStatusBadgeProps {
  status: string
  type: 'invoice' | 'payment'
}

export function DuesStatusBadge({ status, type }: DuesStatusBadgeProps) {
  const configMap = type === 'invoice' ? INVOICE_STATUS_CONFIG : PAYMENT_STATUS_CONFIG
  const config = configMap[status] ?? FALLBACK
  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {config.label}
    </span>
  )
}
