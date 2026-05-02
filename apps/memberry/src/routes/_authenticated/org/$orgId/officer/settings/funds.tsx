import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { FundAllocationEditor } from '@/features/dues/components/fund-allocation-editor'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/settings/funds')({
  component: FundSettingsPage,
})

function FundSettingsPage() {
  const { orgId } = Route.useParams()
  const queryClient = useQueryClient()

  const [funds, setFunds] = useState<{ id?: string; name: string; percentage: string }[]>([
    { name: 'General Fund', percentage: '100' },
  ])
  const [hasChanges, setHasChanges] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['dues-funds', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/dues/funds/${orgId}`)
      return (await res.json()).data
    },
  })

  useEffect(() => {
    if (data && data.length > 0) {
      setFunds(data.map((f: any) => ({ id: f.id, name: f.name, percentage: f.percentage })))
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/dues/funds/${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funds: funds.map((f, i) => ({ name: f.name, percentage: f.percentage, sortOrder: i })),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dues-funds', orgId] })
      toast.success('Fund allocation updated', { description: 'New allocation applies to future payments.' })
      setHasChanges(false)
    },
    onError: (err) => {
      toast.error('Failed to save', { description: err.message })
    },
  })

  const total = funds.reduce((sum, f) => sum + (parseFloat(f.percentage) || 0), 0)
  const isValid = Math.abs(total - 100) < 0.001

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full max-w-2xl" /></div>

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fund Allocation</h1>
        {hasChanges && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
      </div>

      {data && data.length > 0 && (
        <Alert>
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

      <div className="flex gap-3">
        <Button onClick={() => saveMutation.mutate()} disabled={!isValid || saveMutation.isPending || !hasChanges}>
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="outline" onClick={() => { if (data && data.length > 0) { setFunds(data.map((f: any) => ({ id: f.id, name: f.name, percentage: f.percentage }))) }; setHasChanges(false) }} disabled={!hasChanges}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
