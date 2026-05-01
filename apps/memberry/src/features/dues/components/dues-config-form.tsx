import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createDuesConfigMutation,
  listDuesConfigsQueryKey,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { parseCentsInput, validateFundAllocations } from '../lib/money'

interface DuesConfigFormProps {
  orgId: string
  tenantId: string
  onSuccess?: () => void
}

interface FundAllocation {
  fundName: string
  percentage: number
}

export function DuesConfigForm({ orgId, tenantId, onSuccess }: DuesConfigFormProps) {
  const queryClient = useQueryClient()
  const [tierId, setTierId] = useState('')
  const [annualAmount, setAnnualAmount] = useState('')
  const [currency, setCurrency] = useState('PHP')
  const [gracePeriodDays, setGracePeriodDays] = useState('30')
  const [allocations, setAllocations] = useState<FundAllocation[]>([
    { fundName: '', percentage: 100 },
  ])
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    ...createDuesConfigMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listDuesConfigsQueryKey() })
      onSuccess?.()
    },
  })

  const addAllocation = () => {
    setAllocations([...allocations, { fundName: '', percentage: 0 }])
  }

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index))
  }

  const updateAllocation = (index: number, field: keyof FundAllocation, value: string | number) => {
    const updated = [...allocations]
    updated[index] = { ...updated[index]!, [field]: field === 'percentage' ? Number(value) : value }
    setAllocations(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const validation = validateFundAllocations(allocations)
    if (!validation.valid) {
      setError(`Fund allocations must sum to 100% (currently ${validation.sum}%)`)
      return
    }

    const amountCents = parseCentsInput(annualAmount)
    if (amountCents <= 0) {
      setError('Annual amount must be greater than 0')
      return
    }

    createMutation.mutate({
      body: {
        organizationId: orgId,
        tierId,
        annualAmount: amountCents,
        currency,
        gracePeriodDays: Number(gracePeriodDays),
        fundAllocations: allocations.map((a, i) => ({
          ...a,
          isLast: i === allocations.length - 1,
        })),
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'active',
      },
      headers: { 'x-org-id': tenantId },
    } as any)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && (
        <div className="p-3 text-sm text-red-800 bg-red-50 rounded-md">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Tier ID</label>
        <input
          type="text"
          value={tierId}
          onChange={(e) => setTierId(e.target.value)}
          required
          className="w-full px-3 py-2 border rounded-md text-sm"
          placeholder="Select membership tier"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Annual Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={annualAmount}
            onChange={(e) => setAnnualAmount(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-md text-sm"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            <option value="PHP">PHP</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Grace Period (days)</label>
        <input
          type="number"
          min="0"
          max="90"
          value={gracePeriodDays}
          onChange={(e) => setGracePeriodDays(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Fund Allocations</label>
          <button type="button" onClick={addAllocation} className="text-xs text-primary hover:underline">
            + Add Fund
          </button>
        </div>
        {allocations.map((alloc, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text"
              value={alloc.fundName}
              onChange={(e) => updateAllocation(i, 'fundName', e.target.value)}
              placeholder="Fund name"
              required
              className="flex-1 px-3 py-2 border rounded-md text-sm"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={alloc.percentage}
              onChange={(e) => updateAllocation(i, 'percentage', e.target.value)}
              className="w-20 px-3 py-2 border rounded-md text-sm"
            />
            <span className="self-center text-sm text-muted-foreground">%</span>
            {allocations.length > 1 && (
              <button type="button" onClick={() => removeAllocation(i)} className="text-xs text-red-500">
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={createMutation.isPending}
        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
      >
        {createMutation.isPending ? 'Creating...' : 'Create Dues Config'}
      </button>
    </form>
  )
}
