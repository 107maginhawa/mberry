import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listDuesFundsOptions, upsertDuesFundsMutation } from '@monobase/sdk-ts/generated/react-query'
import type { DuesFund } from '@monobase/sdk-ts/generated/types.gen'
import { useState, useEffect } from 'react'
import { Button } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { Alert, AlertDescription } from '@monobase/ui'
import { toast } from 'sonner'
import { FundAllocationEditor } from '@/features/dues/components/fund-allocation-editor'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/settings/funds')({
  component: FundSettingsPage,
})

function FundSettingsPage() {
  const { orgId, orgSlug } = useOrg()
  const queryClient = useQueryClient()

  const [funds, setFunds] = useState<{ id?: string; name: string; percentage: string }[]>([
    { name: 'General Fund', percentage: '100' },
  ])
  const [hasChanges, setHasChanges] = useState(false)

  const { data: fundsData, isLoading } = useQuery({
    ...listDuesFundsOptions({ query: { organizationId: orgId } }),
    select: (d: { data?: DuesFund[] }) => d?.data ?? [],
  })

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
    },
    onError: (err) => {
      toast.error('Failed to save', { description: err.message })
    },
  })

  const total = funds.reduce((sum, f) => sum + (parseFloat(f.percentage) || 0), 0)
  const isValid = Math.abs(total - 100) < 0.001

  if (isLoading) return <div><Skeleton className="h-64 w-full max-w-2xl" /></div>

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Fund Allocation"
        subtitle="Configure how dues are distributed"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Settings' },
          { label: 'Funds' },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {hasChanges && <span className="text-[14px] text-[var(--color-muted)]">Unsaved changes</span>}
            <Button onClick={() => saveMutation.mutate()} disabled={!isValid || saveMutation.isPending || !hasChanges}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        }
      />

      {fundsData && fundsData.length > 0 && (
        <Alert>
          <AlertDescription>
            Existing payment allocations will not be recalculated. Only future payments will use the new allocation.
          </AlertDescription>
        </Alert>
      )}

      <GlassCard className="p-6">
        <FundAllocationEditor
          funds={funds}
          onChange={(updated) => { setFunds(updated); setHasChanges(true) }}
          disabled={saveMutation.isPending}
        />

        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={() => { if (fundsData && fundsData.length > 0) { setFunds(fundsData.map((f) => ({ id: f.id, name: f.name, percentage: String(f.percentage ?? '') }))) }; setHasChanges(false) }} disabled={!hasChanges}>
            Cancel
          </Button>
        </div>
      </GlassCard>
    </div>
  )
}
