import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { generateDuesReportOptions } from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { DatePicker } from '@/components/patterns/date-picker'
import { ReportSelector } from '@/features/dues/components/report-selector'
import { ReportResults } from '@/features/dues/components/report-results'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

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
    <div className="space-y-6">
      <PageHeader
        title="Financial Reports"
        subtitle="Generate and view dues collection reports"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Reports' },
          { label: 'Financial' },
        ]}
      />

      <GlassCard className="p-5">
        <ReportSelector selected={selectedType} onSelect={(type) => { setSelectedType(type); setShouldFetch(false) }} />
      </GlassCard>

      {selectedType && (
        <GlassCard className="p-5">
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <Label>From</Label>
              <DatePicker
                value={fromDate ? new Date(fromDate) : undefined}
                onValueChange={(d) => { setFromDate(d ? d.toISOString().split('T')[0] : ''); setShouldFetch(false) }}
                placeholder="Start date"
              />
            </div>
            <div>
              <Label>To</Label>
              <DatePicker
                value={toDate ? new Date(toDate) : undefined}
                onValueChange={(d) => { setToDate(d ? d.toISOString().split('T')[0] : ''); setShouldFetch(false) }}
                placeholder="End date"
              />
            </div>
            <Button onClick={handleGenerate} disabled={dateError || !selectedType}>
              {shouldFetch && reportData ? 'Refresh' : 'Generate Report'}
            </Button>
            {dateError && <p className="text-xs text-[var(--color-error)]">End date must be after start date.</p>}
          </div>
        </GlassCard>
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
