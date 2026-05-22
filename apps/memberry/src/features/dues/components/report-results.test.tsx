import { describe, test, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { ReportResults } from './report-results'

describe('ReportResults', () => {
  test('shows loading skeletons when isLoading is true', () => {
    const { container } = renderWithProviders(
      <ReportResults type="collection" data={null} summary={null} isLoading={true} />
    )
    const skeletons = container.querySelectorAll('[class*="h-10"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('shows prompt message when data is null', () => {
    renderWithProviders(
      <ReportResults type="collection" data={null} summary={null} isLoading={false} />
    )
    expect(screen.getByText('Select a report type and click Generate.')).toBeInTheDocument()
  })

  test('shows empty data message when data is empty array', () => {
    renderWithProviders(
      <ReportResults type="collection" data={[]} summary={null} isLoading={false} />
    )
    expect(screen.getByText('No data found for the selected period and filters.')).toBeInTheDocument()
  })

  test('renders collection report table with data', () => {
    const data = [
      { month: '2025-01', method: 'online', count: 10, total: 500000 },
      { month: '2025-02', method: 'cash', count: 5, total: 250000 },
    ]
    const summary = { totalCollected: 750000 }

    renderWithProviders(
      <ReportResults type="collection" data={data} summary={summary} isLoading={false} />
    )

    expect(screen.getByText('Month')).toBeInTheDocument()
    expect(screen.getByText('2025-01')).toBeInTheDocument()
    expect(screen.getByText('2025-02')).toBeInTheDocument()
    expect(screen.getByText('online')).toBeInTheDocument()
    expect(screen.getByText('cash')).toBeInTheDocument()
    expect(screen.getByText('Download CSV')).toBeInTheDocument()
  })

  test('renders fund_breakdown report table', () => {
    const data = [
      { fundName: 'General', percentage: 60, totalAllocated: 300000, totalReversals: 10000, netTotal: 290000 },
    ]
    const summary = { fundCount: 1 }

    renderWithProviders(
      <ReportResults type="fund_breakdown" data={data} summary={summary} isLoading={false} />
    )

    expect(screen.getByText('Fund')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('1 funds')).toBeInTheDocument()
  })

  test('renders aging report with bucket badges', () => {
    const data = [
      { personId: 'person-1', amount: 100000, daysPending: 45 },
    ]
    const summary = { totalOverdue: 1 }

    renderWithProviders(
      <ReportResults type="aging" data={data} summary={summary} isLoading={false} />
    )

    expect(screen.getByText('Days Overdue')).toBeInTheDocument()
    expect(screen.getByText('31-60')).toBeInTheDocument()
    expect(screen.getByText('1 overdue payments')).toBeInTheDocument()
  })

  test('renders dues_status report', () => {
    const data = [
      { personId: 'person-1', totalPaid: 250000, lastPaymentDate: '2025-03-15', paymentCount: 3 },
    ]
    const summary = { memberCount: 1 }

    renderWithProviders(
      <ReportResults type="dues_status" data={data} summary={summary} isLoading={false} />
    )

    expect(screen.getByText('Member')).toBeInTheDocument()
    expect(screen.getByText('Total Paid')).toBeInTheDocument()
    expect(screen.getByText('1 members')).toBeInTheDocument()
  })
})
