import { describe, test, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { ReportSelector } from './report-selector'

describe('ReportSelector', () => {
  test('renders all four report types', () => {
    renderWithProviders(
      <ReportSelector selected={null} onSelect={vi.fn()} />
    )

    expect(screen.getByText('Collection Summary')).toBeInTheDocument()
    expect(screen.getByText('Fund Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Dues Status')).toBeInTheDocument()
    expect(screen.getByText('Aging Report')).toBeInTheDocument()
  })

  test('renders descriptions for each report type', () => {
    renderWithProviders(
      <ReportSelector selected={null} onSelect={vi.fn()} />
    )

    expect(screen.getByText('Payments by month, online vs manual')).toBeInTheDocument()
    expect(screen.getByText('Per-fund totals with refund reversals')).toBeInTheDocument()
    expect(screen.getByText('All members with payment status')).toBeInTheDocument()
    expect(screen.getByText('Overdue payments by duration bucket')).toBeInTheDocument()
  })

  test('calls onSelect with the report type when clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    renderWithProviders(
      <ReportSelector selected={null} onSelect={onSelect} />
    )

    await user.click(screen.getByText('Collection Summary'))
    expect(onSelect).toHaveBeenCalledWith('collection')

    await user.click(screen.getByText('Aging Report'))
    expect(onSelect).toHaveBeenCalledWith('aging')
  })

  test('highlights the selected report', () => {
    const { container } = renderWithProviders(
      <ReportSelector selected="fund_breakdown" onSelect={vi.fn()} />
    )

    // The selected button should have the primary border class
    const buttons = container.querySelectorAll('button')
    const fundButton = Array.from(buttons).find(b => b.textContent?.includes('Fund Breakdown'))
    expect(fundButton?.className).toContain('border-[var(--color-primary)]')
  })
})
