const STATUS_CONFIG = {
  active: { label: "Active", className: "text-[var(--color-success)] bg-[var(--color-success-bg)]" },
  grace: { label: "Grace", className: "text-[var(--color-warning)] bg-[var(--color-warning-bg)]" },
  lapsed: { label: "Lapsed", className: "text-[var(--color-error)] bg-[var(--color-error-bg)]" },
  pending: { label: "Pending", className: "text-[var(--color-info)] bg-[var(--color-info-bg)]" },
  suspended: { label: "Suspended", className: "text-[var(--color-muted)] bg-[var(--color-border-light)]" },
} as const

type MembershipStatus = keyof typeof STATUS_CONFIG

export function StatusBadge({ status }: { status: MembershipStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  )
}
