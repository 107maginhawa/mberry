interface StatCardProps {
  label: string
  value: string | number
  change?: { value: string; positive: boolean }
  accent?: boolean
}

export function StatCard({ label, value, change, accent }: StatCardProps) {
  return (
    <div
      className={`rounded-md border p-5 ${
        accent
          ? "bg-[var(--color-cream-light)] border-[var(--color-cream)]"
          : "bg-[var(--color-surface)] border-[var(--color-border-light)]"
      }`}
    >
      <p className="text-[13px] font-medium text-[var(--color-muted)]">{label}</p>
      <p className="text-[30px] font-bold font-display leading-[1.2] text-[var(--color-primary)]" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
      {change && (
        <p className={`text-[12px] font-semibold mt-1 ${change.positive ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`}>
          {change.positive ? "+" : ""}{change.value}
        </p>
      )}
    </div>
  )
}
