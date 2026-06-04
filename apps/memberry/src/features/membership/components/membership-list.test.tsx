import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { MembershipList } from './membership-list'

// Mock the SDK generated hooks
// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
import { listMembershipsOptions } from '@monobase/sdk-ts/generated/react-query'

const mockListMembershipsOptions = listMembershipsOptions as ReturnType<typeof vi.fn>

describe('MembershipList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows loading state while roster is loading', () => {
    mockListMembershipsOptions.mockReturnValue({
      queryKey: ['memberships', 'org-1'],
      queryFn: () => new Promise(() => {}), // never resolves
    })

    renderWithProviders(<MembershipList orgId="org-1" tenantId="tenant-1" />)

    expect(screen.getByText('Loading roster...')).toBeInTheDocument()
  })

  test('shows error state when query fails', async () => {
    mockListMembershipsOptions.mockReturnValue({
      queryKey: ['memberships', 'org-1'],
      queryFn: () => Promise.reject(new Error('Network error')),
    })

    renderWithProviders(<MembershipList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load roster')).toBeInTheDocument()
    })
  })

  test('shows empty state when no members', async () => {
    mockListMembershipsOptions.mockReturnValue({
      queryKey: ['memberships', 'org-1'],
      queryFn: () => Promise.resolve({ data: [] }),
    })

    renderWithProviders(<MembershipList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(
        screen.getByText('No members yet. Start by creating membership tiers and inviting members.')
      ).toBeInTheDocument()
    })
  })

  test('renders member rows with member number, status, and tier', async () => {
    mockListMembershipsOptions.mockReturnValue({
      queryKey: ['memberships', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'mbr-1',
              memberNumber: 'PDA-001',
              personId: 'person-1',
              status: 'active',
              tierId: 'tier-1',
              duesExpiryDate: '2026-12-31',
            },
            {
              id: 'mbr-2',
              memberNumber: 'PDA-002',
              personId: 'person-2',
              status: 'lapsed',
              tierId: 'tier-2',
              duesExpiryDate: '2024-12-31',
            },
          ],
        }),
    })

    renderWithProviders(<MembershipList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('PDA-001')).toBeInTheDocument()
    })

    expect(screen.getByText('PDA-002')).toBeInTheDocument()
    expect(screen.getByText('person-1')).toBeInTheDocument()
    expect(screen.getByText('person-2')).toBeInTheDocument()

    // Status badges
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Lapsed')).toBeInTheDocument()
  })

  test('renders table headers', async () => {
    mockListMembershipsOptions.mockReturnValue({
      queryKey: ['memberships', 'org-1'],
      queryFn: () => Promise.resolve({ data: [{ id: 'mbr-1', memberNumber: 'PDA-001', personId: 'p-1', status: 'active', tierId: 't-1' }] }),
    })

    renderWithProviders(<MembershipList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('Member #')).toBeInTheDocument()
    })

    expect(screen.getByText('Person')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Tier')).toBeInTheDocument()
    expect(screen.getByText('Dues Expiry')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  test('shows Renew button for active members', async () => {
    mockListMembershipsOptions.mockReturnValue({
      queryKey: ['memberships', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            { id: 'mbr-1', memberNumber: 'PDA-001', personId: 'p-1', status: 'active', tierId: 't-1' },
            { id: 'mbr-2', memberNumber: 'PDA-002', personId: 'p-2', status: 'suspended', tierId: 't-1' },
          ],
        }),
    })

    renderWithProviders(<MembershipList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('PDA-001')).toBeInTheDocument()
    })

    // Active is renewable, suspended is not
    const renewButtons = screen.getAllByText('Renew')
    expect(renewButtons).toHaveLength(1)
  })

  test('shows dash for missing member number and dues expiry', async () => {
    mockListMembershipsOptions.mockReturnValue({
      queryKey: ['memberships', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            { id: 'mbr-1', memberNumber: null, personId: 'p-1', status: 'active', tierId: 't-1', duesExpiryDate: null },
          ],
        }),
    })

    renderWithProviders(<MembershipList orgId="org-1" tenantId="tenant-1" />)

    await waitFor(() => {
      expect(screen.getByText('p-1')).toBeInTheDocument()
    })

    // Both member number and dues expiry show dashes
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })
})
