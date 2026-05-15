import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { CertificatePreview } from './certificate-preview'

// Mock SDK hooks
vi.mock('@monobase/sdk-ts/generated/@tanstack/react-query.gen', () => ({
  getCertificateOptions: vi.fn(),
}))

import { getCertificateOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
const mockGetCertificate = getCertificateOptions as ReturnType<typeof vi.fn>

// Mock components
vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>{children}</div>
  ),
}))

vi.mock('@/components/patterns/skeleton-loader', () => ({
  CardSkeleton: () => <div data-testid="card-skeleton">Loading...</div>,
}))

describe('CertificatePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows loading skeletons while fetching', () => {
    mockGetCertificate.mockReturnValue({
      queryKey: ['certificate', 'cert-1'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(<CertificatePreview certificateId="cert-1" />)
    const skeletons = screen.getAllByTestId('card-skeleton')
    expect(skeletons).toHaveLength(2)
  })

  test('shows error state when certificate not found', async () => {
    mockGetCertificate.mockReturnValue({
      queryKey: ['certificate', 'cert-1'],
      queryFn: () => Promise.reject(new Error('Not found')),
    })

    renderWithProviders(<CertificatePreview certificateId="cert-1" />)

    await waitFor(() => {
      expect(
        screen.getByText('Certificate not found or you do not have permission to view it.')
      ).toBeInTheDocument()
    })
  })

  test('renders certificate details when loaded', async () => {
    mockGetCertificate.mockReturnValue({
      queryKey: ['certificate', 'cert-1'],
      queryFn: () =>
        Promise.resolve({
          id: 'cert-1',
          certificateNumber: 'CERT-2025-001',
          trainingId: 'training-abc123',
          organizationId: 'org-1',
          issuedAt: '2025-03-15T00:00:00Z',
        }),
    })

    renderWithProviders(<CertificatePreview certificateId="cert-1" />)

    await waitFor(() => {
      expect(screen.getByText('Certificate of Completion')).toBeInTheDocument()
    })
    expect(screen.getByText('CERT-2025-001')).toBeInTheDocument()
    expect(screen.getByText('training-abc123')).toBeInTheDocument()
    expect(screen.getByText('org-1')).toBeInTheDocument()
  })

  test('renders Download PDF and Copy Verification Link buttons', async () => {
    mockGetCertificate.mockReturnValue({
      queryKey: ['certificate', 'cert-1'],
      queryFn: () =>
        Promise.resolve({
          id: 'cert-1',
          certificateNumber: 'CERT-2025-001',
          trainingId: 'training-abc',
          organizationId: 'org-1',
          issuedAt: '2025-03-15T00:00:00Z',
        }),
    })

    renderWithProviders(<CertificatePreview certificateId="cert-1" />)

    await waitFor(() => {
      expect(screen.getByText('Download PDF')).toBeInTheDocument()
    })
    expect(screen.getByText('Copy Verification Link')).toBeInTheDocument()
  })

  test('shows verification URL with certificate number', async () => {
    mockGetCertificate.mockReturnValue({
      queryKey: ['certificate', 'cert-1'],
      queryFn: () =>
        Promise.resolve({
          id: 'cert-1',
          certificateNumber: 'CERT-2025-001',
          trainingId: 'training-abc',
          organizationId: 'org-1',
          issuedAt: '2025-03-15T00:00:00Z',
        }),
    })

    renderWithProviders(<CertificatePreview certificateId="cert-1" />)

    await waitFor(() => {
      expect(screen.getByText(/verify\/certificate\/CERT-2025-001/)).toBeInTheDocument()
    })
  })
})
