import { describe, test, expect } from 'bun:test'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { FundAllocationPreview } from './fund-allocation-preview'

describe('FundAllocationPreview', () => {
  test('shows general fund message when no funds configured', () => {
    renderWithProviders(
      <FundAllocationPreview amountCents={50000} funds={[]} />
    )

    expect(screen.getByText('All payments go to the General Fund.')).toBeInTheDocument()
  })

  test('renders single fund allocation', () => {
    renderWithProviders(
      <FundAllocationPreview
        amountCents={50000}
        funds={[{ fundId: 'General', percentage: 100 }]}
      />
    )

    expect(screen.getByText('Fund Allocation Preview')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
    // Both line item and total show ₱500.00 for single fund
    expect(screen.getAllByText('₱500.00')).toHaveLength(2)
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  test('renders multiple fund allocations with correct amounts', () => {
    renderWithProviders(
      <FundAllocationPreview
        amountCents={100000}
        funds={[
          { fundId: 'General', percentage: 60 },
          { fundId: 'Building', percentage: 40 },
        ]}
      />
    )

    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Building')).toBeInTheDocument()
    expect(screen.getByText('₱600.00')).toBeInTheDocument()
    expect(screen.getByText('₱400.00')).toBeInTheDocument()
    expect(screen.getByText('₱1,000.00')).toBeInTheDocument()
  })

  test('uses provided currency', () => {
    renderWithProviders(
      <FundAllocationPreview
        amountCents={10000}
        funds={[{ fundId: 'General', percentage: 100 }]}
        currency="USD"
      />
    )

    // Both line item and total show $100.00 for single fund
    expect(screen.getAllByText('$100.00')).toHaveLength(2)
  })
})
