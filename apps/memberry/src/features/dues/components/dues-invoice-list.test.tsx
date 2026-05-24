import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { DuesInvoiceList } from './dues-invoice-list'

// Mock @monobase/ui
vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} {...props}>{children}</button>
  ),
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
  Table: ({ children, className }: any) => <table className={className}>{children}</table>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableRow: ({ children, className }: any) => <tr className={className}>{children}</tr>,
  TableHead: ({ children, className }: any) => <th className={className}>{children}</th>,
  TableCell: ({ children, className }: any) => <td className={className}>{children}</td>,
}))

// Mock EmptyState
vi.mock('@/components/patterns/empty-state', () => ({
  EmptyState: ({ headline, description }: any) => (
    <div data-testid="empty-state">
      <p>{headline}</p>
      <p>{description}</p>
    </div>
  ),
}))

// Mock the SDK generated hooks
vi.mock('@monobase/sdk-ts/generated/@tanstack/react-query.gen', () => ({
  listDuesInvoicesOptions: vi.fn(),
  listDuesInvoicesQueryKey: vi.fn(() => ['dues', 'invoices']),
  markDuesInvoicePaidMutation: vi.fn(),
}))

import {
  listDuesInvoicesOptions,
  markDuesInvoicePaidMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

const mockListDuesInvoicesOptions = listDuesInvoicesOptions as ReturnType<typeof vi.fn>
const mockMarkDuesInvoicePaidMutation = markDuesInvoicePaidMutation as ReturnType<typeof vi.fn>

function setupMutationMock() {
  mockMarkDuesInvoicePaidMutation.mockReturnValue({
    mutationFn: vi.fn().mockResolvedValue({}),
  })
}

describe('DuesInvoiceList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMutationMock()
  })

  test('shows loading state while invoices are loading', async () => {
    mockListDuesInvoicesOptions.mockReturnValue({
      queryKey: ['dues', 'invoices', 'org-1'],
      queryFn: () => new Promise(() => {}), // never resolves
    })

    renderWithProviders(<DuesInvoiceList orgId="org-1" tenantId="tenant-1" />)

    // Loading state renders Skeleton components
    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('shows error state when query fails', async () => {
    mockListDuesInvoicesOptions.mockReturnValue({
      queryKey: ['dues', 'invoices', 'org-1'],
      queryFn: () => Promise.reject(new Error('Network error')),
    })

    renderWithProviders(<DuesInvoiceList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load invoices')).toBeInTheDocument()
    })
  })

  test('shows empty state when no invoices', async () => {
    mockListDuesInvoicesOptions.mockReturnValue({
      queryKey: ['dues', 'invoices', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<DuesInvoiceList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      // EmptyState headline
      expect(screen.getByText('No Invoices Yet')).toBeInTheDocument()
    })
  })

  test('renders invoice rows with number, amount, and status', async () => {
    mockListDuesInvoicesOptions.mockReturnValue({
      queryKey: ['dues', 'invoices', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'inv-1',
              invoiceNumber: 'INV-2025-001',
              personId: 'person-1',
              periodStart: '2025-01-01',
              periodEnd: '2025-12-31',
              totalAmount: 250000, // ₱2,500.00
              status: 'sent',
            },
            {
              id: 'inv-2',
              invoiceNumber: 'INV-2025-002',
              personId: 'person-2',
              periodStart: '2025-01-01',
              periodEnd: '2025-12-31',
              totalAmount: 150000, // ₱1,500.00
              status: 'paid',
            },
          ],
        }),
    })

    renderWithProviders(<DuesInvoiceList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('INV-2025-001')).toBeInTheDocument()
      expect(screen.getByText('INV-2025-002')).toBeInTheDocument()
    })

    // Amounts formatted via formatCents
    expect(screen.getByText('₱2,500.00')).toBeInTheDocument()
    expect(screen.getByText('₱1,500.00')).toBeInTheDocument()

    // Status text (DuesStatusBadge renders capitalized labels)
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
  })

  test('shows Mark Paid button for sent invoices, not for paid ones', async () => {
    mockListDuesInvoicesOptions.mockReturnValue({
      queryKey: ['dues', 'invoices', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'inv-1',
              invoiceNumber: 'INV-2025-001',
              personId: 'person-1',
              periodStart: '2025-01-01',
              periodEnd: '2025-12-31',
              totalAmount: 250000,
              status: 'sent',
            },
            {
              id: 'inv-2',
              invoiceNumber: 'INV-2025-002',
              personId: 'person-2',
              periodStart: '2025-01-01',
              periodEnd: '2025-12-31',
              totalAmount: 150000,
              status: 'paid',
            },
          ],
        }),
    })

    renderWithProviders(<DuesInvoiceList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('INV-2025-001')).toBeInTheDocument()
    })

    // One "Mark Paid" button exists (for 'sent' invoice)
    const markPaidButtons = screen.getAllByText('Mark Paid')
    expect(markPaidButtons).toHaveLength(1)
  })

  test('shows Mark Paid for overdue invoices too', async () => {
    mockListDuesInvoicesOptions.mockReturnValue({
      queryKey: ['dues', 'invoices', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'inv-1',
              invoiceNumber: 'INV-2024-001',
              personId: 'person-1',
              periodStart: '2024-01-01',
              periodEnd: '2024-12-31',
              totalAmount: 250000,
              status: 'overdue',
            },
          ],
        }),
    })

    renderWithProviders(<DuesInvoiceList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('Mark Paid')).toBeInTheDocument()
    })
  })
})
