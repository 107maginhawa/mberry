import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listDuesFundsOptions,
  upsertDuesFundsMutation,
  getDuesFinancialDashboardOptions,
} from '@monobase/sdk-ts/generated/react-query'
import type { DuesFund, FinancialDashboard, GetDuesFinancialDashboardData } from '@monobase/sdk-ts/generated/types.gen'
import { useState, useEffect } from 'react'
import { Button } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { Alert, AlertDescription } from '@monobase/ui'
import { toast } from 'sonner'
import { FundAllocationEditor } from '@/features/dues/components/fund-allocation-editor'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { useOrg } from '@/hooks/useOrg'
import { Wallet, Settings } from 'lucide-react'
import { formatCents } from '@/features/dues/lib/money'

type GetDuesFinancialDashboardDataWithHeaders = GetDuesFinancialDashboardData & {
  headers?: Record<string, string>
}

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/finances/funds')({
  component: FundsPage,
})

function FundsPage() {
  const { orgId, orgSlug } = useOrg()
  const queryClient = useQueryClient()
  const [showEditor, setShowEditor] = useState(false)

  const [funds, setFunds] = useState<{ id?: string; name: string; percentage: string }[]>([
    { name: 'General Fund', percentage: '100' },
  ])
  const [hasChanges, setHasChanges] = useState(false)

  const { data: fundsData, isLoading } = useQuery({
    ...listDuesFundsOptions({ query: { organizationId: orgId } }),
    select: (d: { data?: DuesFund[] }) => d?.data ?? [],
  })

  // Get total collected for balance estimation
  const { data: dashboardData } = useQuery(
    getDuesFinancialDashboardOptions(
      { path: { organizationId: orgId }, headers: { 'x-org-id': orgId } } as unknown as GetDuesFinancialDashboardDataWithHeaders
    )
  )
  const dashboard = dashboardData as FinancialDashboard | undefined
  const totalCollected = Number(dashboard?.totalCollected ?? 0)

  useEffect(() => {
    if (fundsData && fundsData.length > 0) {
      setFunds(fundsData.map((f) => ({ id: f.id, name: f.name, percentage: String(f.percentage ?? '') })))
    }
  }, [fundsData])

  const upsertMutOpts = upsertDuesFundsMutation()
  const saveMutation = useMutation<unknown, Error, void>({
    mutationFn: () => (upsertMutOpts.mutationFn as (...args: unknown[]) => Promise<unknown>)({
      path: { organizationId: orgId },
      body: { funds: funds.map((f, i) => ({ name: f.name, percentage: f.percentage, sortOrder: i })) },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listDuesFunds'] })
      toast.success('Fund allocation updated', { description: 'New allocation applies to future payments.' })
      setHasChanges(false)
      setShowEditor(false)
    },
    onError: (err) => {
      toast.error('Failed to save', { description: err.message })
    },
  })

  const total = funds.reduce((sum, f) => sum + (parseFloat(f.percentage) || 0), 0)
  const isValid = Math.abs(total - 100) < 0.001

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    )
  }

  const hasFunds = fundsData && fundsData.length > 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Funds"
        subtitle="Fund accounting — how dues are distributed"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Finances', href: `/org/${orgSlug}/officer/finances` },
          { label: 'Funds' },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => setShowEditor(!showEditor)}>
            <Settings className="h-4 w-4 mr-1.5" /> Edit Rules
          </Button>
        }
      />

      {/* Fund balance cards */}
      {hasFunds ? (
        <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {fundsData.map((fund) => {
            const pct = Number(fund.percentage ?? 0)
            const estimatedBalance = Math.round((totalCollected * pct) / 100)

            return (
              <StaggerItem key={fund.id}>
                <GlassCard className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-4 w-4 text-[var(--color-primary)]" />
                    <span className="text-sm font-medium">{fund.name}</span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums font-display">
                    <CountUp
                      value={estimatedBalance / 100}
                      prefix="₱"
                      format={(n) => n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    />
                  </p>
                  <p className="text-xs text-[var(--color-muted)] mt-1">{pct}% of dues</p>
                </GlassCard>
              </StaggerItem>
            )
          })}
        </StaggerGrid>
      ) : (
        <GlassCard className="p-8 text-center">
          <Wallet className="h-10 w-10 text-[var(--color-muted)] mx-auto mb-3" />
          <h3 className="font-medium mb-1">No funds configured</h3>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Set up fund allocation rules to distribute dues across building, operating, and reserve funds.
          </p>
          <Button onClick={() => setShowEditor(true)}>
            Configure Funds
          </Button>
        </GlassCard>
      )}

      {/* Fund allocation editor (collapsible) */}
      {showEditor && (
        <GlassCard className="p-6 max-w-2xl">
          <h3 className="font-medium mb-4">Allocation Rules</h3>

          {hasFunds && (
            <Alert className="mb-4">
              <AlertDescription>
                Existing payment allocations will not be recalculated. Only future payments will use the new allocation.
              </AlertDescription>
            </Alert>
          )}

          <FundAllocationEditor
            funds={funds}
            onChange={(updated) => { setFunds(updated); setHasChanges(true) }}
            disabled={saveMutation.isPending}
          />

          <div className="flex gap-3 mt-4">
            <Button onClick={() => saveMutation.mutate()} disabled={!isValid || saveMutation.isPending || !hasChanges}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (fundsData && fundsData.length > 0) {
                  setFunds(fundsData.map((f) => ({ id: f.id, name: f.name, percentage: String(f.percentage ?? '') })))
                }
                setHasChanges(false)
                setShowEditor(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </GlassCard>
      )}

      {/* Recent fund activity */}
      {hasFunds && (
        <GlassCard className="p-5">
          <h3 className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">Recent Fund Activity</h3>
          <div className="py-6 text-center text-sm text-[var(--color-muted)]">
            Fund transaction history will appear here as payments are processed and allocated.
          </div>
        </GlassCard>
      )}
    </div>
  )
}
