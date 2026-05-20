import { formatCents } from '../lib/money'
import { allocateFunds, type FundSplit } from '../lib/fund-math'

interface FundAllocationPreviewProps {
  amountCents: number
  funds: FundSplit[]
  currency?: string
}

export function FundAllocationPreview({ amountCents, funds, currency = 'PHP' }: FundAllocationPreviewProps) {
  if (funds.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">All payments go to the General Fund.</p>
  }

  const allocations = allocateFunds(amountCents, funds)

  return (
    <div className="space-y-2">
      <h4 className="text-h4">Fund Allocation Preview</h4>
      <div className="space-y-1">
        {allocations.map((alloc, i) => (
          <div key={alloc.fundId} className="flex justify-between text-sm">
            <span>{funds[i]?.fundId ?? `Fund ${i + 1}`}</span>
            <span className="font-mono">{formatCents(alloc.amount, currency)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm font-medium border-t pt-1">
        <span>Total</span>
        <span className="font-mono">{formatCents(amountCents, currency)}</span>
      </div>
    </div>
  )
}
