import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { MemberDetail } from './member-detail'

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useParams: () => ({ orgSlug: 'test-org' }),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

// Mock UI wrapper components to simplify rendering
vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>{children}</div>
  ),
}))

vi.mock('@/components/patterns/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}))

vi.mock('@/components/patterns/skeleton-loader', () => ({
  ProfileSkeleton: () => <div data-testid="profile-skeleton">Loading profile...</div>,
}))

// Mock SDK generated hooks
// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
import {
  getRosterMemberOptions,
  updateRosterMemberMutation,
  listMembershipCategoriesOptions,
  reinstateMembershipMutation,
  terminateMembershipMutation,
} from '@monobase/sdk-ts/generated/react-query'

const mockGetRosterMemberOptions = getRosterMemberOptions as ReturnType<typeof vi.fn>
const mockUpdateRosterMemberMutation = updateRosterMemberMutation as ReturnType<typeof vi.fn>
const mockListMembershipCategoriesOptions = listMembershipCategoriesOptions as ReturnType<typeof vi.fn>
const mockReinstateMembershipMutation = reinstateMembershipMutation as ReturnType<typeof vi.fn>
const mockTerminateMembershipMutation = terminateMembershipMutation as ReturnType<typeof vi.fn>

function setupMutationMocks() {
  mockUpdateRosterMemberMutation.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
  mockReinstateMembershipMutation.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
  mockTerminateMembershipMutation.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
  mockListMembershipCategoriesOptions.mockReturnValue({
    queryKey: ['categories', 'org-1'],
    queryFn: () => Promise.resolve({ data: [] }),
  })
}

const MOCK_ACTIVE_MEMBER = {
  id: 'mbr-1',
  personId: 'person-1',
  name: 'Dr. Maria Santos',
  email: 'maria@example.com',
  phone: '+639171234567',
  memberNumber: 'PDA-001',
  status: 'active',
  categoryId: 'cat-1',
  categoryName: 'Regular',
  duesExpiryDate: '2026-12-31',
  joinedAt: '2020-01-15',
}

describe('MemberDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMutationMocks()
  })

  test('shows loading skeleton while member is loading', () => {
    mockGetRosterMemberOptions.mockReturnValue({
      queryKey: ['roster-member', 'mbr-1'],
      queryFn: () => new Promise(() => {}), // never resolves
    })

    renderWithProviders(<MemberDetail orgId="org-1" memberId="mbr-1" />)

    expect(screen.getByTestId('profile-skeleton')).toBeInTheDocument()
  })

  test('shows error state when query fails', async () => {
    mockGetRosterMemberOptions.mockReturnValue({
      queryKey: ['roster-member', 'mbr-1'],
      queryFn: () => Promise.reject(new Error('Network error')),
    })

    renderWithProviders(<MemberDetail orgId="org-1" memberId="mbr-1" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load member details.')).toBeInTheDocument()
    })
  })

  test('renders active member profile with name, email, and status badge', async () => {
    mockGetRosterMemberOptions.mockReturnValue({
      queryKey: ['roster-member', 'mbr-1'],
      queryFn: () => Promise.resolve(MOCK_ACTIVE_MEMBER),
    })

    renderWithProviders(<MemberDetail orgId="org-1" memberId="mbr-1" />)

    await waitFor(() => {
      // Name appears in PageHeader mock + h1 heading
      expect(screen.getAllByText('Dr. Maria Santos').length).toBeGreaterThanOrEqual(1)
    })

    // Email in contact section
    expect(screen.getByText('maria@example.com')).toBeInTheDocument()

    // Phone in contact section
    expect(screen.getByText('+639171234567')).toBeInTheDocument()

    // Member number
    expect(screen.getByText('PDA-001')).toBeInTheDocument()

    // Category badge
    expect(screen.getAllByText('Regular').length).toBeGreaterThanOrEqual(1)

    // Active status badges (may appear multiple times: header badge + membership info)
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1)
  })

  test('shows action buttons for active member', async () => {
    mockGetRosterMemberOptions.mockReturnValue({
      queryKey: ['roster-member', 'mbr-1'],
      queryFn: () => Promise.resolve(MOCK_ACTIVE_MEMBER),
    })

    renderWithProviders(<MemberDetail orgId="org-1" memberId="mbr-1" />)

    await waitFor(() => {
      expect(screen.getAllByText('Dr. Maria Santos').length).toBeGreaterThanOrEqual(1)
    })

    // Active members can: Change Category, Record Payment, Suspend, Mark Deceased
    expect(screen.getByText('Change Category')).toBeInTheDocument()
    expect(screen.getByText('Record Payment')).toBeInTheDocument()
    expect(screen.getByText('Suspend Member')).toBeInTheDocument()
    expect(screen.getByText('Mark Deceased')).toBeInTheDocument()

    // Active members should NOT see Reinstate
    expect(screen.queryByText('Reinstate')).not.toBeInTheDocument()
  })

  test('shows Reinstate button and banner for suspended member', async () => {
    mockGetRosterMemberOptions.mockReturnValue({
      queryKey: ['roster-member', 'mbr-1'],
      queryFn: () =>
        Promise.resolve({
          ...MOCK_ACTIVE_MEMBER,
          status: 'suspended',
          suspendedReason: 'Non-compliance',
        }),
    })

    renderWithProviders(<MemberDetail orgId="org-1" memberId="mbr-1" />)

    await waitFor(() => {
      expect(screen.getAllByText('Dr. Maria Santos').length).toBeGreaterThanOrEqual(1)
    })

    // Suspended banner
    expect(screen.getByText('Membership is currently suspended.')).toBeInTheDocument()

    // Suspended reason displayed
    expect(screen.getByText(/Non-compliance/)).toBeInTheDocument()

    // Reinstate button shown
    expect(screen.getByText('Reinstate')).toBeInTheDocument()

    // Suspend button NOT shown for already-suspended member
    expect(screen.queryByText('Suspend Member')).not.toBeInTheDocument()
  })

  test('shows lapsed banner for lapsed member', async () => {
    mockGetRosterMemberOptions.mockReturnValue({
      queryKey: ['roster-member', 'mbr-1'],
      queryFn: () =>
        Promise.resolve({
          ...MOCK_ACTIVE_MEMBER,
          status: 'lapsed',
        }),
    })

    renderWithProviders(<MemberDetail orgId="org-1" memberId="mbr-1" />)

    await waitFor(() => {
      expect(
        screen.getByText('Membership has lapsed. Member must renew to regain access to benefits.')
      ).toBeInTheDocument()
    })
  })

  test('shows no contact info message when email and phone are absent', async () => {
    mockGetRosterMemberOptions.mockReturnValue({
      queryKey: ['roster-member', 'mbr-1'],
      queryFn: () =>
        Promise.resolve({
          ...MOCK_ACTIVE_MEMBER,
          email: undefined,
          phone: undefined,
        }),
    })

    renderWithProviders(<MemberDetail orgId="org-1" memberId="mbr-1" />)

    await waitFor(() => {
      expect(screen.getByText('No contact info available.')).toBeInTheDocument()
    })
  })
})
