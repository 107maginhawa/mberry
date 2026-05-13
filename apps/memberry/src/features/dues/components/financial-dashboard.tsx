import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { getDuesFinancialDashboardOptions } from '@monobase/sdk-ts/generated/react-query'
import { Skeleton } from '@monobase/ui'
import { AlertTriangle, CreditCard, Settings } from 'lucide-react'
import { formatCents } from '../lib/money'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'

interface FinancialDashboardProps {
  orgId: string
}

export function FinancialDashboard({ orgId }: FinancialDashboardProps) {
  // Cast to any: TypeSpec FinancialDashboard type differs from hand-wired endpoint shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading } = useQuery(getDuesFinancialDashboardOptions({ path: { organizationId: orgId } }) as any) as { data: any; isLoading: boolean }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-[12px] animate-shimmer" />
        ))}
      </div>
    )
  }

  const collectionRate = data?.collectionRate ?? 0
  const totalCollected = Number(data?.totalCollected ?? 0)
  const totalOutstanding = Number(data?.totalOutstanding ?? 0)
  const pendingCount = data?.pendingCount ?? 0
  const expiringCount = data?.expiringThisMonth ?? 0
  const hasGateway = data?.gatewayConfigured ?? false

  const rateColor = collectionRate > 80 ? 'text-green-600' : collectionRate > 50 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="space-y-4">
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StaggerItem>
          <GlassCard className="p-4">
            <p className="text-[13px] text-[var(--color-muted)]">Collection Rate</p>
            <p className={`text-h2 font-display font-bold tabular-nums ${rateColor}`}>
              <CountUp value={collectionRate} format={(n) => `${Math.round(n)}%`} />
            </p>
          </GlassCard>
        </StaggerItem>
        <StaggerItem>
          <GlassCard className="p-4">
            <p className="text-[13px] text-[var(--color-muted)]">Total Collected</p>
            <p className="text-h2 font-display font-bold tabular-nums">
              <CountUp value={totalCollected / 100} prefix="₱" format={(n) => n.toLocaleString('en-PH', { minimumFractionDigits: 2 })} />
            </p>
          </GlassCard>
        </StaggerItem>
        <StaggerItem>
          <GlassCard className="p-4">
            <p className="text-[13px] text-[var(--color-muted)]">Outstanding</p>
            <p className="text-h2 font-display font-bold tabular-nums">
              <CountUp value={totalOutstanding / 100} prefix="₱" format={(n) => n.toLocaleString('en-PH', { minimumFractionDigits: 2 })} />
            </p>
          </GlassCard>
        </StaggerItem>
        <StaggerItem>
          <GlassCard className="p-4">
            <p className="text-[13px] text-[var(--color-muted)]">Pending Payments</p>
            <p className="text-h2 font-display font-bold tabular-nums">
              <CountUp value={pendingCount} />
            </p>
          </GlassCard>
        </StaggerItem>
      </StaggerGrid>

      {/* Action cards */}
      {(expiringCount > 0 || pendingCount > 0 || !hasGateway) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {expiringCount > 0 && (
            <GlassCard className="flex items-center gap-3 p-3 border-amber-200/50">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1 text-[14px]">
                <p className="font-semibold text-amber-900">{expiringCount} members with expiring dues</p>
                <p className="text-amber-700 text-[13px]">Send reminders before they lapse</p>
              </div>
            </GlassCard>
          )}
          {pendingCount > 0 && (
            <GlassCard className="flex items-center gap-3 p-3 border-blue-200/50">
              <CreditCard className="h-5 w-5 text-blue-600 shrink-0" />
              <div className="flex-1 text-[14px]">
                <p className="font-semibold text-blue-900">{pendingCount} pending payments</p>
                <p className="text-blue-700 text-[13px]">Review and confirm</p>
              </div>
            </GlassCard>
          )}
          {!hasGateway && (
            <Link
              to="/org/$orgId/officer/settings/gateway"
              params={{ orgId }}
            >
              <GlassCard className="flex items-center gap-3 p-3 h-full">
                <Settings className="h-5 w-5 text-[var(--color-muted)] shrink-0" />
                <div className="flex-1 text-[14px]">
                  <p className="font-semibold">Gateway not configured</p>
                  <p className="text-[var(--color-muted)] text-[13px]">Set up online payments</p>
                </div>
              </GlassCard>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
