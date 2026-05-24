import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { PaymentHistoryTable } from './payment-history-table'

vi.mock('@monobase/sdk-ts/generated/react-query', () => ({
  listDuesPaymentsOptions: vi.fn(),
}))

vi.mock('@/components/patterns/empty-state', () => ({
  EmptyState: ({ headline, description }: any) => (
    <div>
      <h3>{headline}</h3>
      <p>{description}</p>
    </div>
  ),
}))

import { listDuesPaymentsOptions } from '@monobase/sdk-ts/generated/react-query'

const mockListPayments = listDuesPaymentsOptions as ReturnType<typeof vi.fn>

describe('PaymentHistoryTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows loading skeletons while data loads', () => {
    mockListPayments.mockReturnValue({
      queryKey: ['dues', 'payments'],
      queryFn: () => new Promise(() => {}),
    })

    const { container } = renderWithProviders(
      <PaymentHistoryTable orgId="org-1" scope="org" />
    )
    const skeletons = container.querySelectorAll('.animate-shimmer')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('shows empty state when no payments match filters', async () => {
    mockListPayments.mockReturnValue({
      queryKey: ['dues', 'payments'],
      queryFn: () => Promise.resolve({ data: [], pagination: { totalCount: 0 } }),
    })

    renderWithProviders(
      <PaymentHistoryTable orgId="org-1" scope="org" />
    )

    await waitFor(() => {
      expect(screen.getByText('No Payments Found')).toBeInTheDocument()
    })
  })

  test('renders payment rows with data', async () => {
    mockListPayments.mockReturnValue({
      queryKey: ['dues', 'payments'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'p-1',
              paidAt: '2025-03-15T00:00:00Z',
              receiptNumber: 'REC-001',
              amount: 250000,
              currency: 'PHP',
              paymentMethod: 'gcash',
              status: 'completed',
            },
            {
              id: 'p-2',
              paidAt: '2025-04-01T00:00:00Z',
              receiptNumber: 'REC-002',
              amount: 100000,
              currency: 'PHP',
              paymentMethod: 'cash',
              status: 'pending',
            },
          ],
          pagination: { totalCount: 2 },
        }),
    })

    renderWithProviders(
      <PaymentHistoryTable orgId="org-1" scope="org" />
    )

    await waitFor(() => {
      expect(screen.getByText('REC-001')).toBeInTheDocument()
      expect(screen.getByText('REC-002')).toBeInTheDocument()
    })

    expect(screen.getByText('₱2,500.00')).toBeInTheDocument()
    expect(screen.getByText('₱1,000.00')).toBeInTheDocument()
    expect(screen.getByText('GCash')).toBeInTheDocument()
    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  test('renders filter dropdowns', () => {
    mockListPayments.mockReturnValue({
      queryKey: ['dues', 'payments'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(
      <PaymentHistoryTable orgId="org-1" scope="org" />
    )

    // Filter selects are rendered
    expect(screen.getByText('All Statuses')).toBeInTheDocument()
    expect(screen.getByText('All Methods')).toBeInTheDocument()
  })
})
