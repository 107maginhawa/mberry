import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { generateDuesReportOptions } from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { ReportSelector } from '@/features/dues/components/report-selector'
import { ReportResults } from '@/features/dues/components/report-results'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/reports/financial')({
  component: FinancialReportsPage,
})

function FinancialReportsPage() {
  const { orgId } = Route.useParams()

  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  const [shouldFetch, setShouldFetch] = useState(false)

  const { data: reportData, isLoading } = useQuery({
    ...generateDuesReportOptions({
      path: { organizationId: orgId },
      query: {
        type: (selectedType ?? 'collection') as 'collection' | 'fund_breakdown' | 'dues_status' | 'aging',
        from: fromDate ? new Date(fromDate) : undefined,
        to: toDate ? new Date(toDate) : undefined,
      },
    }),
    enabled: shouldFetch && !!selectedType,
  })

  const handleGenerate = () => {
    setShouldFetch(true)
  }

  const dateError = fromDate && toDate ? new Date(fromDate) > new Date(toDate) : false

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Financial Reports</h1>

      <ReportSelector selected={selectedType} onSelect={(type) => { setSelectedType(type); setShouldFetch(false) }} />

      {selectedType && (
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <Label>From</Label>
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setShouldFetch(false) }} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setShouldFetch(false) }} />
          </div>
          <Button onClick={handleGenerate} disabled={dateError || !selectedType}>
            {shouldFetch && reportData ? 'Refresh' : 'Generate Report'}
          </Button>
          {dateError && <p className="text-xs text-destructive">End date must be after start date.</p>}
        </div>
      )}

      <ReportResults
        type={selectedType ?? ''}
        data={reportData?.data ?? null}
        summary={reportData?.summary ?? null}
        isLoading={isLoading && shouldFetch}
      />
    </div>
  )
}
