import { GlassCard } from '@/components/motion/glass-card'

interface DeliveryFunnelProps {
  sent: number
  delivered: number
  opened: number
  clicked: number
}

const STAGES = ['Sent', 'Delivered', 'Opened', 'Clicked'] as const

/**
 * Delivery funnel visualization showing sent → delivered → opened → clicked
 * with proportional bar widths and rate percentages.
 */
export function DeliveryFunnel({ sent, delivered, opened, clicked }: DeliveryFunnelProps) {
  if (sent === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <p className="text-sm text-[var(--color-muted)]">No data yet</p>
      </GlassCard>
    )
  }

  const values = [sent, delivered, opened, clicked]
  const rates = [
    100,
    Math.round((delivered / sent) * 100),
    Math.round((opened / sent) * 100),
    Math.round((clicked / sent) * 100),
  ]

  const openRate = rates[2]
  const openRateColor =
    openRate > 50 ? 'text-[var(--color-success)]' :
    openRate < 20 ? 'text-[var(--color-warning)]' :
    'text-[var(--color-text)]'

  return (
    <GlassCard className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Delivery Funnel</h3>
        <span data-testid="open-rate" className={`text-sm font-bold ${openRateColor}`}>
          {openRate}% open rate
        </span>
      </div>

      <div className="space-y-3">
        {STAGES.map((stage, i) => (
          <div key={stage} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-muted)]">{stage}</span>
              <span className="font-medium tabular-nums">
                {values[i].toLocaleString()} {i > 0 && <span className="text-[var(--color-muted)]">({rates[i]}%)</span>}
              </span>
            </div>
            <div className="h-2 bg-[var(--color-surface-warm)] rounded-full overflow-hidden">
              <div
                data-testid={`funnel-bar-${stage.toLowerCase()}`}
                className="h-full bg-[var(--color-primary)] rounded-full transition-all"
                style={{ width: `${rates[i]}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
