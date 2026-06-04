import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { FundAllocationEditor } from './fund-allocation-editor'

describe('FundAllocationEditor', () => {
  test('renders fund rows with name and percentage inputs', () => {
    const funds = [
      { name: 'General Fund', percentage: '60' },
      { name: 'Building Fund', percentage: '40' },
    ]

    renderWithProviders(
      <FundAllocationEditor funds={funds} onChange={vi.fn()} />
    )

    expect(screen.getByDisplayValue('General Fund')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Building Fund')).toBeInTheDocument()
    expect(screen.getByDisplayValue('60')).toBeInTheDocument()
    expect(screen.getByDisplayValue('40')).toBeInTheDocument()
  })

  test('shows valid total when percentages sum to 100', () => {
    const funds = [
      { name: 'General', percentage: '60' },
      { name: 'Building', percentage: '40' },
    ]

    renderWithProviders(
      <FundAllocationEditor funds={funds} onChange={vi.fn()} />
    )

    expect(screen.getByText('Total: 100.00%')).toBeInTheDocument()
    expect(screen.queryByText('Must equal exactly 100%')).not.toBeInTheDocument()
  })

  test('shows error when percentages do not sum to 100', () => {
    const funds = [
      { name: 'General', percentage: '60' },
      { name: 'Building', percentage: '30' },
    ]

    renderWithProviders(
      <FundAllocationEditor funds={funds} onChange={vi.fn()} />
    )

    expect(screen.getByText('Total: 90.00%')).toBeInTheDocument()
    expect(screen.getByText('Must equal exactly 100%')).toBeInTheDocument()
  })

  test('shows Add Fund button', () => {
    renderWithProviders(
      <FundAllocationEditor funds={[{ name: 'General', percentage: '100' }]} onChange={vi.fn()} />
    )

    expect(screen.getByText('Add Fund')).toBeInTheDocument()
  })

  test('calls onChange when Add Fund is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const funds = [{ name: 'General', percentage: '100' }]

    renderWithProviders(
      <FundAllocationEditor funds={funds} onChange={onChange} />
    )

    await user.click(screen.getByText('Add Fund'))
    expect(onChange).toHaveBeenCalledWith([
      { name: 'General', percentage: '100' },
      { name: '', percentage: '' },
    ])
  })

  test('shows rounding note when multiple funds exist', () => {
    const funds = [
      { name: 'General', percentage: '60' },
      { name: 'Building', percentage: '40' },
    ]

    renderWithProviders(
      <FundAllocationEditor funds={funds} onChange={vi.fn()} />
    )

    expect(screen.getByText(/Last fund absorbs rounding remainder/)).toBeInTheDocument()
  })

  test('does not show delete button for single fund', () => {
    renderWithProviders(
      <FundAllocationEditor funds={[{ name: 'General', percentage: '100' }]} onChange={vi.fn()} />
    )

    // No trash icon when single fund
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  test('disables inputs when disabled prop is true', () => {
    const funds = [{ name: 'General', percentage: '100' }]

    renderWithProviders(
      <FundAllocationEditor funds={funds} onChange={vi.fn()} disabled={true} />
    )

    expect(screen.getByDisplayValue('General')).toBeDisabled()
    expect(screen.getByDisplayValue('100')).toBeDisabled()
    expect(screen.getByText('Add Fund').closest('button')).toBeDisabled()
  })
})
