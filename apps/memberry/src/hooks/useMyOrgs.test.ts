import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock @/lib/api
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  useLocation: vi.fn(),
}))

import { api } from '@/lib/api'
import { useLocation } from '@tanstack/react-router'
import { useMyOrgs } from './useMyOrgs'

const mockApiGet = api.get as ReturnType<typeof vi.fn>
const mockUseLocation = useLocation as ReturnType<typeof vi.fn>

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
  return Wrapper
}

describe('useMyOrgs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLocation.mockReturnValue({ pathname: '/' })
  })

  test('returns empty array when no memberships', async () => {
    mockApiGet.mockResolvedValue({ data: [] })

    const { result } = renderHook(() => useMyOrgs(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.orgs).toEqual([])
    expect(result.current.error).toBeNull()
  })

  test('maps API response to OrgMembership shape', async () => {
    mockApiGet.mockResolvedValue({
      data: [
        {
          id: 'm-1',
          organizationId: 'org-1',
          orgName: 'Test Org',
          orgSlug: 'test-org',
          memberNumber: 'MEM-001',
          status: 'active',
          tierId: 'tier-1',
          startDate: '2025-01-01',
          duesExpiryDate: '2026-01-01',
        },
        {
          id: 'm-2',
          organizationId: 'org-2',
          orgName: '',
          orgSlug: '',
          memberNumber: undefined,
          status: '',
          tierId: undefined,
          startDate: undefined,
          duesExpiryDate: undefined,
        },
      ],
    })

    const { result } = renderHook(() => useMyOrgs(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.orgs).toHaveLength(2)
    expect(result.current.orgs[0]).toEqual({
      id: 'm-1',
      organizationId: 'org-1',
      orgName: 'Test Org',
      orgSlug: 'test-org',
      memberNumber: 'MEM-001',
      status: 'active',
      tierId: 'tier-1',
      startDate: '2025-01-01',
      duesExpiryDate: '2026-01-01',
    })
    // Verify fallbacks: empty orgName/orgSlug stay '', empty status falls back to 'active'
    expect(result.current.orgs[1]).toEqual({
      id: 'm-2',
      organizationId: 'org-2',
      orgName: '',
      orgSlug: '',
      memberNumber: undefined,
      status: 'active',
      tierId: undefined,
      startDate: undefined,
      duesExpiryDate: undefined,
    })
  })

  test('detects active org from URL', async () => {
    mockUseLocation.mockReturnValue({ pathname: '/org/test-slug/home' })
    mockApiGet.mockResolvedValue({ data: [] })

    const { result } = renderHook(() => useMyOrgs(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.activeOrgSlug).toBe('test-slug')
  })

  test('returns null activeOrgSlug when not on org route', async () => {
    mockUseLocation.mockReturnValue({ pathname: '/my/events' })
    mockApiGet.mockResolvedValue({ data: [] })

    const { result } = renderHook(() => useMyOrgs(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.activeOrgSlug).toBeNull()
  })

  test('exposes error state on fetch failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useMyOrgs(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.orgs).toEqual([])
  })
})
