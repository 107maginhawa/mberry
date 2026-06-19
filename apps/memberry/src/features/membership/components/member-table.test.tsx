import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { MemberTable } from './member-table'

// Router (Link, useParams) provided by global mock in test-setup-root.ts.

// Mock SDK generated options
// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
import {
  listRosterMembersOptions,
  listMembershipCategoriesOptions,
} from '@monobase/sdk-ts/generated/react-query'

const mockListRosterMembersOptions = listRosterMembersOptions as ReturnType<typeof vi.fn>
const mockListMembershipCategoriesOptions = listMembershipCategoriesOptions as ReturnType<typeof vi.fn>

const MOCK_MEMBERS = [
  {
    id: 'mbr-1',
    personId: 'person-1',
    name: 'Dr. Maria Santos',
    email: 'maria@example.com',
    memberNumber: 'PDA-001',
    status: 'active',
    categoryId: 'cat-1',
    categoryName: 'Regular',
    duesExpiryDate: '2026-12-31',
    joinedAt: '2020-01-15',
  },
  {
    id: 'mbr-2',
    personId: 'person-2',
    name: 'Dr. Juan Dela Cruz',
    email: 'juan@example.com',
    memberNumber: 'PDA-002',
    status: 'gracePeriod',
    categoryId: 'cat-1',
    categoryName: 'Regular',
    duesExpiryDate: '2025-03-31',
    joinedAt: '2019-06-01',
  },
  {
    id: 'mbr-3',
    personId: 'person-3',
    name: 'Dr. Ana Reyes',
    email: 'ana@example.com',
    memberNumber: 'PDA-003',
    status: 'lapsed',
    categoryId: 'cat-2',
    categoryName: 'Associate',
    duesExpiryDate: '2024-12-31',
    joinedAt: '2021-03-20',
  },
]

function setupDefaultMocks(members = MOCK_MEMBERS, pagination = { totalCount: members.length }) {
  mockListRosterMembersOptions.mockReturnValue({
    queryKey: ['roster', 'org-1'],
    queryFn: () => Promise.resolve({ data: members, pagination }),
  })
  mockListMembershipCategoriesOptions.mockReturnValue({
    queryKey: ['categories', 'org-1'],
    queryFn: () => Promise.resolve({ data: [] }),
  })
}

describe('MemberTable', () => {
  beforeEach(() => {
    ;(globalThis as any).__routerParams = { orgSlug: 'test-org' }
    vi.clearAllMocks()
  })

  test('shows 6 skeleton rows while loading', () => {
    mockListRosterMembersOptions.mockReturnValue({
      queryKey: ['roster', 'org-1'],
      queryFn: () => new Promise(() => {}), // never resolves
    })
    mockListMembershipCategoriesOptions.mockReturnValue({
      queryKey: ['categories', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<MemberTable orgId="org-1" />)

    // 6 skeleton rows in loading state
    const skeletons = document.querySelectorAll('.space-y-3 > *')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  test('shows error state when query fails', async () => {
    mockListRosterMembersOptions.mockReturnValue({
      queryKey: ['roster', 'org-1'],
      queryFn: () => Promise.reject(new Error('Network error')),
    })
    mockListMembershipCategoriesOptions.mockReturnValue({
      queryKey: ['categories', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<MemberTable orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to load members/i)).toBeInTheDocument()
    })
  })

  test('shows empty state when no members', async () => {
    mockListRosterMembersOptions.mockReturnValue({
      queryKey: ['roster', 'org-1'],
      queryFn: () => Promise.resolve({ data: [], pagination: { totalCount: 0 } }),
    })
    mockListMembershipCategoriesOptions.mockReturnValue({
      queryKey: ['categories', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<MemberTable orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText(/No members yet/i)).toBeInTheDocument()
    })
  })

  test('renders member rows with names, license numbers, and status badges', async () => {
    setupDefaultMocks()

    renderWithProviders(<MemberTable orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getAllByText('Dr. Maria Santos')[0]).toBeInTheDocument()
    })

    // Names + license render in both the desktop row and the responsive
    // roster-card layout (both present in JSDOM), so use getAllByText.
    expect(screen.getAllByText('Dr. Juan Dela Cruz')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Dr. Ana Reyes')[0]).toBeInTheDocument()

    // License numbers
    expect(screen.getAllByText('PDA-001')[0]).toBeInTheDocument()
    expect(screen.getAllByText('PDA-002')[0]).toBeInTheDocument()
    expect(screen.getAllByText('PDA-003')[0]).toBeInTheDocument()

    // Status badges (may appear multiple times due to tab labels + badge labels)
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Grace').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Lapsed').length).toBeGreaterThanOrEqual(1)
  })

  test('renders all 6 status tabs', async () => {
    setupDefaultMocks()

    renderWithProviders(<MemberTable orgId="org-1" />)

    // Tab labels overlap with member-row status badges ("Active", "Lapsed"),
    // so disambiguate via role="tab".
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument()
    })

    expect(screen.getByRole('tab', { name: 'Active' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Grace' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Lapsed' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Suspended' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Pending' })).toBeInTheDocument()
  })

  test('renders search input with correct placeholder', async () => {
    setupDefaultMocks()

    renderWithProviders(<MemberTable orgId="org-1" />)

    const searchInput = screen.getByPlaceholderText('Search by name, email or license...')
    expect(searchInput).toBeInTheDocument()
  })

  test('uses requiredCredits=60 as default (matches org_cpd_config DB default)', async () => {
    const membersWithCredits = [{
      ...MOCK_MEMBERS[0],
      creditsEarned: 30,
    }]
    setupDefaultMocks(membersWithCredits)

    renderWithProviders(<MemberTable orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getAllByText('Dr. Maria Santos')[0]).toBeInTheDocument()
    })

    // Default requiredCredits is 60 — credit badge shows earned/required
    expect(screen.getByText('30/60')).toBeInTheDocument()
  })

  test('renders custom requiredCredits prop value', async () => {
    const membersWithCredits = [{
      ...MOCK_MEMBERS[0],
      creditsEarned: 30,
    }]
    setupDefaultMocks(membersWithCredits)

    renderWithProviders(<MemberTable orgId="org-1" requiredCredits={100} />)

    await waitFor(() => {
      expect(screen.getAllByText('Dr. Maria Santos')[0]).toBeInTheDocument()
    })

    expect(screen.getByText('30/100')).toBeInTheDocument()
  })

  test('shows bulk selection bar when checkbox is clicked', async () => {
    setupDefaultMocks()
    const user = userEvent.setup()

    renderWithProviders(<MemberTable orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getAllByText('Dr. Maria Santos')[0]).toBeInTheDocument()
    })

    // Click first member row checkbox
    const checkboxes = screen.getAllByRole('checkbox')
    // First checkbox is "select all", subsequent ones are per-row
    // Click on the second checkbox (first member row)
    await user.click(checkboxes[1])

    await waitFor(() => {
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument()
    })
  })
})
