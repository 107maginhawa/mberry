import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { PendingProofsList } from './pending-proofs-list'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/patterns/empty-state', () => ({
  EmptyState: ({ headline, description }: any) => (
    <div>
      <h3>{headline}</h3>
      <p>{description}</p>
    </div>
  ),
}))

vi.mock('@/components/patterns/skeleton-loader', () => ({
  ListSkeleton: () => <div data-testid="list-skeleton">Loading...</div>,
}))

import { listPendingProofsOptions } from '@monobase/sdk-ts/generated/react-query'

const mockListPendingProofs = listPendingProofsOptions as ReturnType<typeof vi.fn>

describe('PendingProofsList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows loading skeleton while data loads', () => {
    mockListPendingProofs.mockReturnValue({
      queryKey: ['dues', 'pending-proofs'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(<PendingProofsList orgId="org-1" />)
    expect(screen.getByTestId('list-skeleton')).toBeInTheDocument()
  })

  test('shows error state when query fails', async () => {
    mockListPendingProofs.mockReturnValue({
      queryKey: ['dues', 'pending-proofs'],
      queryFn: () => Promise.reject(new Error('Network error')),
    })

    renderWithProviders(<PendingProofsList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load pending proofs.')).toBeInTheDocument()
    })
  })

  test('shows empty state when no pending proofs', async () => {
    mockListPendingProofs.mockReturnValue({
      queryKey: ['dues', 'pending-proofs'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<PendingProofsList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('No pending proofs')).toBeInTheDocument()
      expect(screen.getByText('All payment proofs have been reviewed.')).toBeInTheDocument()
    })
  })

  test('renders proof cards with Confirm and Reject buttons', async () => {
    mockListPendingProofs.mockReturnValue({
      queryKey: ['dues', 'pending-proofs'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'proof-1',
              receiptNumber: 'REC-001',
              amount: 250000,
              currency: 'PHP',
              paymentMethod: 'gcash',
              referenceNumber: 'GC-123',
              personId: 'person-abc12345',
              paidAt: '2025-03-15T00:00:00Z',
              proofMimeType: 'image/jpeg',
              proofFileName: 'screenshot.jpg',
            },
          ],
        }),
    })

    renderWithProviders(<PendingProofsList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('REC-001')).toBeInTheDocument()
    })

    expect(screen.getByText('Pending Review')).toBeInTheDocument()
    expect(screen.getByText('₱2,500.00')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Reject')).toBeInTheDocument()
  })
})
