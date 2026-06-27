import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./use-member-data', () => ({
  useMemberData: vi.fn(),
}))

import { useMemberData } from './use-member-data'
import { MembershipTile } from './MembershipTile'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQuery(overrides: Record<string, unknown>) {
  return {
    isLoading: false,
    isError: false,
    isSuccess: false,
    data: undefined,
    ...overrides,
  }
}

function mockMemberData(membershipsOverrides: Record<string, unknown>) {
  vi.mocked(useMemberData).mockReturnValue({
    membershipsQuery: makeQuery(membershipsOverrides) as any,
    invoicesQuery: makeQuery({}) as any,
    paymentsQuery: makeQuery({}) as any,
    outstandingInvoices: [],
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MembershipTile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loading: shows skeletons', () => {
    mockMemberData({ isLoading: true })
    render(<MembershipTile />)
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })

  it('error: shows role=alert error message', () => {
    mockMemberData({ isLoading: false, isError: true })
    render(<MembershipTile />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/could not load/i)).toBeTruthy()
  })

  it('empty: shows "No active membership" when data is empty array', () => {
    mockMemberData({ isLoading: false, isSuccess: true, data: [] })
    render(<MembershipTile />)
    expect(screen.getByText('No active membership')).toBeTruthy()
  })

  it('data: shows orgName and StatusBadge', () => {
    mockMemberData({
      isLoading: false,
      isSuccess: true,
      data: [
        {
          // DRIFT: handler returns orgName/duesExpiryDate/joinedAt; SDK type omits them
          id: 'm1',
          organizationId: 'org-1',
          orgId: 'org-1',
          orgName: 'PDA Manila',
          orgSlug: 'pda-manila',
          status: 'active',
          duesExpiryDate: null,
          joinedAt: '2024-01-15',
          startDate: '2024-01-15',
          memberNumber: 'M-001',
          tierId: null,
          categoryId: null,
          personId: 'person-1',
        },
      ],
    })
    render(<MembershipTile />)
    expect(screen.getByText('PDA Manila')).toBeTruthy()
    // StatusBadge with status="active" renders "Active"
    expect(screen.getByTestId('status-badge')).toBeTruthy()
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('[review m8] duesExpiryDate string is formatted as a human date under "Renews" label', () => {
    mockMemberData({
      isLoading: false,
      isSuccess: true,
      data: [
        {
          id: 'm1',
          organizationId: 'org-1',
          orgId: 'org-1',
          orgName: 'PDA Manila',
          orgSlug: 'pda-manila',
          status: 'active',
          // [review m8] string date — transformer does NOT date-convert duesExpiryDate
          duesExpiryDate: '2025-12-31',
          joinedAt: '2024-01-15',
          startDate: '2024-01-15',
          memberNumber: 'M-001',
          tierId: null,
          categoryId: null,
          personId: 'person-1',
        },
      ],
    })
    render(<MembershipTile />)
    // "Renews" label present + formatted date (year 2025 must appear)
    expect(screen.getByText(/renews/i)).toBeTruthy()
    expect(screen.getByText(/2025/)).toBeTruthy()
  })

  it('[review m8] null duesExpiryDate: no renewal label rendered', () => {
    mockMemberData({
      isLoading: false,
      isSuccess: true,
      data: [
        {
          id: 'm1',
          organizationId: 'org-1',
          orgId: 'org-1',
          orgName: 'PDA Manila',
          orgSlug: 'pda-manila',
          status: 'grace',
          duesExpiryDate: null,   // [review m8] guard null
          joinedAt: null,
          startDate: null,
          memberNumber: null,
          tierId: null,
          categoryId: null,
          personId: 'person-1',
        },
      ],
    })
    render(<MembershipTile />)
    expect(screen.queryByText(/renews/i)).toBeNull()
  })
})
