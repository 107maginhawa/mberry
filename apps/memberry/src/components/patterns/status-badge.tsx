import type { ReactNode } from "react"

const STATUS_CONFIG = {
  active: { label: "Active", variant: "success" as const },
  grace: { label: "Grace", variant: "warning" as const },
  lapsed: { label: "Lapsed", variant: "error" as const },
  pending: { label: "Pending", variant: "info" as const },
  suspended: { label: "Suspended", variant: "muted" as const },
} as const

type MembershipStatus = keyof typeof STATUS_CONFIG

export type StatusBadgeVariant = "success" | "warning" | "error" | "info" | "muted" | "accent"

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  success: "text-[var(--color-success)] bg-[var(--color-success-bg)]",
  warning: "text-[var(--color-warning)] bg-[var(--color-warning-bg)]",
  error: "text-[var(--color-error)] bg-[var(--color-error-bg)]",
  info: "text-[var(--color-info)] bg-[var(--color-info-bg)]",
  muted: "text-[var(--color-muted)] bg-[var(--color-border-light)]",
  accent: "text-purple-700 bg-purple-100",
}

interface StatusProp {
  status: MembershipStatus
  variant?: never
  children?: never
}

interface VariantProp {
  status?: never
  variant: StatusBadgeVariant
  children: ReactNode
}

export type StatusBadgeProps = (StatusProp | VariantProp) & {
  className?: string
}

const BASE = "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold"

export function StatusBadge(props: StatusBadgeProps) {
  if (props.status !== undefined) {
    const config = STATUS_CONFIG[props.status] ?? STATUS_CONFIG.pending
    return (
      <span
        data-testid="status-badge"
        className={`${BASE} ${VARIANT_CLASSES[config.variant]} ${props.className ?? ""}`.trim()}
      >
        {config.label}
      </span>
    )
  }
  return (
    <span
      data-testid="status-badge"
      className={`${BASE} ${VARIANT_CLASSES[props.variant]} ${props.className ?? ""}`.trim()}
    >
      {props.children}
    </span>
  )
}
