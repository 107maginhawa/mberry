import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCents } from '../lib/money'
import { Download } from 'lucide-react'

interface ReportResultsProps {
  type: string
  data: any[] | null
  summary: any | null
  isLoading: boolean
}

export function ReportResults({ type, data, summary, isLoading }: ReportResultsProps) {
  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
  }

  if (!data) {
    return <p className="text-center text-muted-foreground py-8">Select a report type and click Generate.</p>
  }

  if (data.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No data found for the selected period and filters.</p>
  }

  const exportCSV = () => {
    let csv = ''
    if (type === 'collection') {
      csv = 'Month,Method,Count,Total\n' + data.map((r: any) => `${r.month},${r.method},${r.count},${r.total}`).join('\n')
    } else if (type === 'fund_breakdown') {
      csv = 'Fund,Percentage,Allocated,Reversals,Net\n' + data.map((r: any) => `${r.fundName},${r.percentage}%,${r.totalAllocated},${r.totalReversals},${r.netTotal}`).join('\n')
    } else if (type === 'dues_status') {
      csv = 'Person ID,Total Paid,Last Payment,Count\n' + data.map((r: any) => `${r.personId},${r.totalPaid},${r.lastPaymentDate},${r.paymentCount}`).join('\n')
    } else if (type === 'aging') {
      csv = 'Person ID,Amount,Days Pending\n' + data.map((r: any) => `${r.personId},${r.amount},${r.daysPending}`).join('\n')
    }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${type}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Summary metrics */}
      {summary && (
        <div className="flex gap-4 flex-wrap">
          {type === 'collection' && summary.totalCollected != null && (
            <Badge variant="secondary" className="text-sm px-3 py-1">Total: {formatCents(summary.totalCollected)}</Badge>
          )}
          {type === 'aging' && summary.totalOverdue != null && (
            <Badge variant="secondary" className="text-sm px-3 py-1">{summary.totalOverdue} overdue payments</Badge>
          )}
          {type === 'fund_breakdown' && (
            <Badge variant="secondary" className="text-sm px-3 py-1">{summary.fundCount} funds</Badge>
          )}
          {type === 'dues_status' && (
            <Badge variant="secondary" className="text-sm px-3 py-1">{summary.memberCount} members</Badge>
          )}
        </div>
      )}

      {/* Export */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> Download CSV
        </Button>
      </div>

      {/* Results table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead>
            <tr className="border-b bg-muted/50">
              {type === 'collection' && <><th className="px-3 py-2 text-left">Month</th><th className="px-3 py-2 text-left">Method</th><th className="px-3 py-2 text-right">Count</th><th className="px-3 py-2 text-right">Total</th></>}
              {type === 'fund_breakdown' && <><th className="px-3 py-2 text-left">Fund</th><th className="px-3 py-2 text-right">%</th><th className="px-3 py-2 text-right">Allocated</th><th className="px-3 py-2 text-right">Reversals</th><th className="px-3 py-2 text-right">Net</th></>}
              {type === 'dues_status' && <><th className="px-3 py-2 text-left">Member</th><th className="px-3 py-2 text-right">Total Paid</th><th className="px-3 py-2 text-left">Last Payment</th><th className="px-3 py-2 text-right">Count</th></>}
              {type === 'aging' && <><th className="px-3 py-2 text-left">Member</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Days Overdue</th><th className="px-3 py-2 text-left">Bucket</th></>}
            </tr>
          </thead>
          <tbody>
            {data.map((row: any, i: number) => (
              <tr key={i} className="border-b">
                {type === 'collection' && <><td className="px-3 py-2">{row.month}</td><td className="px-3 py-2">{row.method}</td><td className="px-3 py-2 text-right">{row.count}</td><td className="px-3 py-2 text-right font-mono">{formatCents(row.total)}</td></>}
                {type === 'fund_breakdown' && <><td className="px-3 py-2">{row.fundName}</td><td className="px-3 py-2 text-right">{row.percentage}%</td><td className="px-3 py-2 text-right font-mono">{formatCents(row.totalAllocated)}</td><td className="px-3 py-2 text-right font-mono text-red-600">{formatCents(row.totalReversals)}</td><td className="px-3 py-2 text-right font-mono font-medium">{formatCents(row.netTotal)}</td></>}
                {type === 'dues_status' && <><td className="px-3 py-2 font-mono text-xs">{row.personId}</td><td className="px-3 py-2 text-right font-mono">{formatCents(row.totalPaid)}</td><td className="px-3 py-2">{row.lastPaymentDate ? new Date(row.lastPaymentDate).toLocaleDateString() : '—'}</td><td className="px-3 py-2 text-right">{row.paymentCount}</td></>}
                {type === 'aging' && <><td className="px-3 py-2 font-mono text-xs">{row.personId}</td><td className="px-3 py-2 text-right font-mono">{formatCents(row.amount)}</td><td className="px-3 py-2 text-right">{row.daysPending}</td><td className="px-3 py-2"><Badge variant="secondary">{row.daysPending <= 30 ? '1-30' : row.daysPending <= 60 ? '31-60' : row.daysPending <= 90 ? '61-90' : '90+'}</Badge></td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
