import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { CertificateList } from './certificate-list'

// Mock TanStack Router (requires RouterProvider without mock)
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, className }: any) => {
    const href = to?.replace('$certificateId', params?.certificateId || '')
    return <a href={href} className={className}>{children}</a>
  },
  useNavigate: () => vi.fn(),
}))

// Mock SDK hooks
// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
import { listMyCertificatesOptions } from '@monobase/sdk-ts/generated/react-query'
const mockListCerts = listMyCertificatesOptions as ReturnType<typeof vi.fn>

// Mock useOrgContext
vi.mock('@/hooks/useOrgContext', () => ({
  useOrgContext: vi.fn(() => ({ orgId: 'org-1', source: 'url' })),
}))

// Mock motion/pattern components
vi.mock('@/components/patterns/empty-state', () => ({
  EmptyState: ({ headline, description }: { headline: string; description: string; icon?: React.ReactNode }) => (
    <div data-testid="empty-state">
      <p>{headline}</p>
      <p>{description}</p>
    </div>
  ),
}))

vi.mock('@/components/patterns/skeleton-loader', () => ({
  CardSkeleton: () => <div data-testid="card-skeleton">Loading...</div>,
}))

vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>{children}</div>
  ),
}))

vi.mock('@/components/motion/stagger-grid', () => ({
  StaggerGrid: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  StaggerItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('CertificateList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows loading skeletons while fetching', () => {
    mockListCerts.mockReturnValue({
      queryKey: ['certificates', 'my'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(<CertificateList />)
    const skeletons = screen.getAllByTestId('card-skeleton')
    expect(skeletons).toHaveLength(3)
  })

  test('shows empty state when no certificates', async () => {
    mockListCerts.mockReturnValue({
      queryKey: ['certificates', 'my'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<CertificateList />)

    await waitFor(() => {
      expect(screen.getByText('No certificates issued yet')).toBeInTheDocument()
    })
    expect(screen.getByText('Complete a training to earn your first certificate.')).toBeInTheDocument()
  })

  test('renders certificate cards with number and training ID', async () => {
    mockListCerts.mockReturnValue({
      queryKey: ['certificates', 'my'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'cert-1',
              certificateNumber: 'CERT-2025-001',
              trainingId: 'training-abcdef12',
              issuedAt: '2025-03-15T00:00:00Z',
            },
            {
              id: 'cert-2',
              certificateNumber: 'CERT-2025-002',
              trainingId: 'training-99887766',
              issuedAt: '2025-04-01T00:00:00Z',
            },
          ],
        }),
    })

    renderWithProviders(<CertificateList />)

    await waitFor(() => {
      expect(screen.getByText('CERT-2025-001')).toBeInTheDocument()
    })
    expect(screen.getByText('CERT-2025-002')).toBeInTheDocument()
    // Training ID is truncated: .slice(0, 8) + "..." — both certs have similar prefix
    const trainingLabels = screen.getAllByText(/Training ID:/)
    expect(trainingLabels).toHaveLength(2)
  })

  test('renders certificate links to detail page', async () => {
    mockListCerts.mockReturnValue({
      queryKey: ['certificates', 'my'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'cert-1',
              certificateNumber: 'CERT-2025-001',
              trainingId: 'training-abcdef12',
              issuedAt: '2025-03-15T00:00:00Z',
            },
          ],
        }),
    })

    renderWithProviders(<CertificateList />)

    await waitFor(() => {
      const link = screen.getByText('Training Certificate').closest('a')
      expect(link).toHaveAttribute('href', '/my/certificates/cert-1')
    })
  })
})
