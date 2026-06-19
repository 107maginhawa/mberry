import { useState } from 'react'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { GripVertical, Trash2, Plus } from 'lucide-react'

interface Fund {
  id?: string
  name: string
  percentage: string
}

interface FundAllocationEditorProps {
  funds: Fund[]
  onChange: (funds: Fund[]) => void
  disabled?: boolean
}

export function FundAllocationEditor({ funds, onChange, disabled }: FundAllocationEditorProps) {
  const total = funds.reduce((sum, f) => sum + (parseFloat(f.percentage) || 0), 0)
  const isValid = Math.abs(total - 100) < 0.001

  const addFund = () => {
    onChange([...funds, { name: '', percentage: '' }])
  }

  const removeFund = (index: number) => {
    onChange(funds.filter((_, i) => i !== index))
  }

  const updateFund = (index: number, field: keyof Fund, value: string) => {
    const updated = [...funds]
    updated[index] = { ...updated[index]!, [field]: value }
    onChange(updated)
  }

  const moveFund = (from: number, to: number) => {
    const updated = [...funds]
    const [moved] = updated.splice(from, 1)
    updated.splice(to, 0, moved!)
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Fund Allocations</Label>
        <Button type="button" variant="outline" size="sm" onClick={addFund} disabled={disabled}>
          <Plus className="h-3 w-3 mr-1" /> Add Fund
        </Button>
      </div>

      {funds.map((fund, i) => (
        <div key={i} className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="cursor-grab"
            onClick={() => { if (i > 0) moveFund(i, i - 1) }}
            disabled={disabled}
            aria-label="Move fund up"
          >
            <GripVertical className="h-4 w-4" />
          </Button>
          <Input
            value={fund.name}
            onChange={(e) => updateFund(i, 'name', e.target.value)}
            placeholder="Fund name"
            className="flex-1"
            disabled={disabled}
          />
          <div className="flex items-center gap-1 w-28">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={fund.percentage}
              onChange={(e) => updateFund(i, 'percentage', e.target.value)}
              className="w-20"
              disabled={disabled}
            />
            <span className="text-sm text-[var(--color-muted)]">%</span>
          </div>
          {funds.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeFund(i)}
              disabled={disabled}
              className="text-[var(--color-error)] hover:text-[var(--color-error)]"
              aria-label="Remove fund"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      {funds.length > 1 && (
        <p className="text-xs text-[var(--color-muted)]">
          Last fund absorbs rounding remainder to ensure exact totals.
        </p>
      )}

      <div className={`text-sm font-medium ${isValid ? 'text-green-600' : 'text-[var(--color-error)]'}`}>
        Total: {total.toFixed(2)}%
        {!isValid && <span className="ml-2 font-normal">Must equal exactly 100%</span>}
      </div>
    </div>
  )
}
