// oli-execute: error-handled-inline -- consumed by parent finances/reports route.
import { Badge } from '@monobase/ui'
import { Button } from '@monobase/ui'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { formatCents } from '../lib/money'
import { Download, FileBarChart2, Inbox } from 'lucide-react'
import { EmptyState } from '@/components/patterns/empty-state'

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
    return (
      <EmptyState
        icon={<FileBarChart2 size={40} />}
        headline="No report generated yet"
        description="Select a report type and click Generate."
      />
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={40} />}
        headline="No data found"
        description="Try a different period or relax your filters."
      />
    )
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
      <Table className="text-sm border">
        <TableHeader>
          <TableRow className="bg-[var(--color-surface-warm)]">
            {type === 'collection' && <><TableHead className="px-3 py-2">Month</TableHead><TableHead className="px-3 py-2">Method</TableHead><TableHead className="px-3 py-2 text-right">Count</TableHead><TableHead className="px-3 py-2 text-right">Total</TableHead></>}
            {type === 'fund_breakdown' && <><TableHead className="px-3 py-2">Fund</TableHead><TableHead className="px-3 py-2 text-right">%</TableHead><TableHead className="px-3 py-2 text-right">Allocated</TableHead><TableHead className="px-3 py-2 text-right">Reversals</TableHead><TableHead className="px-3 py-2 text-right">Net</TableHead></>}
            {type === 'dues_status' && <><TableHead className="px-3 py-2">Member</TableHead><TableHead className="px-3 py-2 text-right">Total Paid</TableHead><TableHead className="px-3 py-2">Last Payment</TableHead><TableHead className="px-3 py-2 text-right">Count</TableHead></>}
            {type === 'aging' && <><TableHead className="px-3 py-2">Member</TableHead><TableHead className="px-3 py-2 text-right">Amount</TableHead><TableHead className="px-3 py-2 text-right">Days Overdue</TableHead><TableHead className="px-3 py-2">Bucket</TableHead></>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row: any, i: number) => (
            <TableRow key={i}>
              {type === 'collection' && <><TableCell className="px-3 py-2">{row.month}</TableCell><TableCell className="px-3 py-2">{row.method}</TableCell><TableCell className="px-3 py-2 text-right">{row.count}</TableCell><TableCell className="px-3 py-2 text-right font-mono">{formatCents(row.total)}</TableCell></>}
              {type === 'fund_breakdown' && <><TableCell className="px-3 py-2">{row.fundName}</TableCell><TableCell className="px-3 py-2 text-right">{row.percentage}%</TableCell><TableCell className="px-3 py-2 text-right font-mono">{formatCents(row.totalAllocated)}</TableCell><TableCell className="px-3 py-2 text-right font-mono text-red-600">{formatCents(row.totalReversals)}</TableCell><TableCell className="px-3 py-2 text-right font-mono font-medium">{formatCents(row.netTotal)}</TableCell></>}
              {type === 'dues_status' && <><TableCell className="px-3 py-2 font-mono text-xs">{row.personId}</TableCell><TableCell className="px-3 py-2 text-right font-mono">{formatCents(row.totalPaid)}</TableCell><TableCell className="px-3 py-2">{row.lastPaymentDate ? new Date(row.lastPaymentDate).toLocaleDateString() : '—'}</TableCell><TableCell className="px-3 py-2 text-right">{row.paymentCount}</TableCell></>}
              {type === 'aging' && <><TableCell className="px-3 py-2 font-mono text-xs">{row.personId}</TableCell><TableCell className="px-3 py-2 text-right font-mono">{formatCents(row.amount)}</TableCell><TableCell className="px-3 py-2 text-right">{row.daysPending}</TableCell><TableCell className="px-3 py-2"><Badge variant="secondary">{row.daysPending <= 30 ? '1-30' : row.daysPending <= 60 ? '31-60' : row.daysPending <= 90 ? '61-90' : '90+'}</Badge></TableCell></>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
