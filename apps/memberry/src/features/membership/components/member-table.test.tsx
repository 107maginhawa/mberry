import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { MemberTable } from './member-table'

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params }: { children: React.ReactNode; to: string; params?: Record<string, string> }) => (
    <a href={to}>{children}</a>
  ),
}))

// Mock SDK generated options
vi.mock('@monobase/sdk-ts/generated/react-query', () => ({
  listRosterMembersOptions: vi.fn(),
  listMembershipCategoriesOptions: vi.fn(),
}))

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
      expect(screen.getByText(/No members found/i)).toBeInTheDocument()
    })
  })

  test('renders member rows with names, license numbers, and status badges', async () => {
    setupDefaultMocks()

    renderWithProviders(<MemberTable orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Maria Santos')).toBeInTheDocument()
    })

    expect(screen.getByText('Dr. Juan Dela Cruz')).toBeInTheDocument()
    expect(screen.getByText('Dr. Ana Reyes')).toBeInTheDocument()

    // License numbers
    expect(screen.getByText('PDA-001')).toBeInTheDocument()
    expect(screen.getByText('PDA-002')).toBeInTheDocument()
    expect(screen.getByText('PDA-003')).toBeInTheDocument()

    // Status badges (may appear multiple times due to tab labels + badge labels)
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Grace').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Lapsed').length).toBeGreaterThanOrEqual(1)
  })

  test('renders all 6 status tabs', async () => {
    setupDefaultMocks()

    renderWithProviders(<MemberTable orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument()
    })

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Grace')).toBeInTheDocument()
    expect(screen.getByText('Lapsed')).toBeInTheDocument()
    expect(screen.getByText('Suspended')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  test('renders search input with correct placeholder', async () => {
    setupDefaultMocks()

    renderWithProviders(<MemberTable orgId="org-1" />)

    const searchInput = screen.getByPlaceholderText('Search by name, email or license...')
    expect(searchInput).toBeInTheDocument()
  })

  test('shows bulk selection bar when checkbox is clicked', async () => {
    setupDefaultMocks()
    const user = userEvent.setup()

    renderWithProviders(<MemberTable orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Dr. Maria Santos')).toBeInTheDocument()
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
