/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

let _apiGetImpl: (...args: any[]) => Promise<any> = async () => ({ data: [] })

mock.module('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => _apiGetImpl(...args),
  },
}))

function setPathname(pathname: string) {
  ;(globalThis as any).__routerLocation = { pathname }
}

const { useMyOrgs } = await import('./use-my-orgs')

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
    setPathname('/')
    _apiGetImpl = async () => ({ data: [] })
  })

  test('returns empty array when no memberships', async () => {
    _apiGetImpl = async () => ({ data: [] })
    const { result } = renderHook(() => useMyOrgs(), { wrapper: createWrapper() })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.orgs).toEqual([])
    expect(result.current.error).toBeNull()
  })

  test('maps API response to OrgMembership shape', async () => {
    _apiGetImpl = async () => ({
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
    setPathname('/org/test-slug/home')
    _apiGetImpl = async () => ({ data: [] })
    const { result } = renderHook(() => useMyOrgs(), { wrapper: createWrapper() })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.activeOrgSlug).toBe('test-slug')
  })

  test('returns null activeOrgSlug when not on org route', async () => {
    setPathname('/my/events')
    _apiGetImpl = async () => ({ data: [] })
    const { result } = renderHook(() => useMyOrgs(), { wrapper: createWrapper() })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.activeOrgSlug).toBeNull()
  })

  test('exposes error state on fetch failure', async () => {
    _apiGetImpl = async () => { throw new Error('Network error') }
    const { result } = renderHook(() => useMyOrgs(), { wrapper: createWrapper() })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.error).toBeTruthy()
    expect(result.current.orgs).toEqual([])
  })
})
