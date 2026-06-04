import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { ApplicationList } from './application-list'

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

// Mock UI wrapper components
vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>{children}</div>
  ),
}))

vi.mock('@/components/patterns/empty-state', () => ({
  EmptyState: ({ headline, description }: { headline: string; description: string; icon?: React.ReactNode }) => (
    <div data-testid="empty-state">
      <p>{headline}</p>
      <p>{description}</p>
    </div>
  ),
}))

vi.mock('@/components/patterns/skeleton-loader', () => ({
  ListSkeleton: ({ rows }: { rows?: number }) => (
    <div data-testid="list-skeleton">Loading {rows ?? 3} rows...</div>
  ),
}))

vi.mock('@/components/patterns/avatar-initials', () => ({
  AvatarInitials: ({ name }: { name: string; size?: string; photoUrl?: string }) => (
    <span data-testid="avatar-initials">{name.charAt(0)}</span>
  ),
}))

// Mock SDK generated hooks
// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
import {
  listMembershipApplicationsOptions,
  approveMembershipApplicationMutation,
  denyMembershipApplicationMutation,
} from '@monobase/sdk-ts/generated/react-query'

const mockListMembershipApplicationsOptions = listMembershipApplicationsOptions as ReturnType<typeof vi.fn>
const mockApproveMembershipApplicationMutation = approveMembershipApplicationMutation as ReturnType<typeof vi.fn>
const mockDenyMembershipApplicationMutation = denyMembershipApplicationMutation as ReturnType<typeof vi.fn>

function setupMutationMocks() {
  mockApproveMembershipApplicationMutation.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
  mockDenyMembershipApplicationMutation.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
}

const MOCK_APPLICATIONS = [
  {
    id: 'app-1',
    personId: 'person-1',
    name: 'Dr. Maria Santos',
    email: 'maria@example.com',
    status: 'submitted',
    categoryName: 'Regular',
    appliedAt: '2025-06-01T10:00:00Z',
    createdAt: '2025-06-01T10:00:00Z',
  },
  {
    id: 'app-2',
    personId: 'person-2',
    name: 'Dr. Juan Dela Cruz',
    email: 'juan@example.com',
    status: 'approved',
    categoryName: 'Associate',
    appliedAt: '2025-05-20T08:00:00Z',
    createdAt: '2025-05-20T08:00:00Z',
  },
]

describe('ApplicationList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMutationMocks()
  })

  test('shows loading skeleton while applications are loading', () => {
    mockListMembershipApplicationsOptions.mockReturnValue({
      queryKey: ['applications', 'org-1'],
      queryFn: () => new Promise(() => {}), // never resolves
    })

    renderWithProviders(<ApplicationList orgId="org-1" />)

    expect(screen.getByTestId('list-skeleton')).toBeInTheDocument()
  })

  test('shows error state when query fails', async () => {
    mockListMembershipApplicationsOptions.mockReturnValue({
      queryKey: ['applications', 'org-1'],
      queryFn: () => Promise.reject(new Error('Network error')),
    })

    renderWithProviders(<ApplicationList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load applications. Please try again.')).toBeInTheDocument()
    })
  })

  test('shows empty state when no applications', async () => {
    mockListMembershipApplicationsOptions.mockReturnValue({
      queryKey: ['applications', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<ApplicationList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('No applications found')).toBeInTheDocument()
    })
  })

  test('renders application cards with names and status badges', async () => {
    mockListMembershipApplicationsOptions.mockReturnValue({
      queryKey: ['applications', 'org-1'],
      queryFn: () => Promise.resolve({ data: MOCK_APPLICATIONS }),
    })

    renderWithProviders(<ApplicationList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Maria Santos')).toBeInTheDocument()
    })

    expect(screen.getByText('Dr. Juan Dela Cruz')).toBeInTheDocument()

    // Status badges -- "Pending" also appears as the default filter label
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  test('shows result count', async () => {
    mockListMembershipApplicationsOptions.mockReturnValue({
      queryKey: ['applications', 'org-1'],
      queryFn: () => Promise.resolve({ data: MOCK_APPLICATIONS }),
    })

    renderWithProviders(<ApplicationList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('2 results')).toBeInTheDocument()
    })
  })

  test('shows Approve and Deny buttons when expanding a submitted application', async () => {
    mockListMembershipApplicationsOptions.mockReturnValue({
      queryKey: ['applications', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [MOCK_APPLICATIONS[0]], // submitted only
        }),
    })

    const user = userEvent.setup()

    renderWithProviders(<ApplicationList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Maria Santos')).toBeInTheDocument()
    })

    // Click on the card header to expand
    await user.click(screen.getByText('Dr. Maria Santos'))

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument()
      expect(screen.getByText('Deny')).toBeInTheDocument()
    })
  })

  test('shows singular result count for 1 application', async () => {
    mockListMembershipApplicationsOptions.mockReturnValue({
      queryKey: ['applications', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [MOCK_APPLICATIONS[0]],
        }),
    })

    renderWithProviders(<ApplicationList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument()
    })
  })

  test('renders email in expanded application card', async () => {
    mockListMembershipApplicationsOptions.mockReturnValue({
      queryKey: ['applications', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [MOCK_APPLICATIONS[0]],
        }),
    })

    const user = userEvent.setup()

    renderWithProviders(<ApplicationList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Maria Santos')).toBeInTheDocument()
    })

    // Email shown in collapsed card header
    expect(screen.getByText('maria@example.com')).toBeInTheDocument()
  })
})
