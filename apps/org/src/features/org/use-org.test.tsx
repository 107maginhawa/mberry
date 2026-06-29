import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ getMyMemberships: vi.fn() }))
import { getMyMemberships } from '@monobase/sdk-ts/generated'
import { useOrgs, useSelectedOrg } from './use-org'
import { ok } from '../../test-utils/mock-sdk'

// F4: QueryClient created inside useState so it's stable across re-renders (anti-pattern fix).
function wrapper({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => localStorage.clear())

describe('useOrgs', () => {
  it('dedupes memberships into distinct orgs', async () => {
    // engine type/impl drift: handler returns {data:[{organizationId,orgName,...}],total} but generated
    // MyMembership type lacks orgName/orgSlug. Anchor to handler shape.
    vi.mocked(getMyMemberships).mockResolvedValue(
      ok({ data: [
        { organizationId: 'o1', orgName: 'Chapter A' },
        { organizationId: 'o1', orgName: 'Chapter A' },
        { organizationId: 'o2', orgName: 'Chapter B' },
      ], total: 3 } as any)
    )
    const { result } = renderHook(() => useOrgs(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.orgs).toEqual([{ id: 'o1', name: 'Chapter A' }, { id: 'o2', name: 'Chapter B' }])
  })

  it('empty when no memberships', async () => {
    // engine type/impl drift: see above
    vi.mocked(getMyMemberships).mockResolvedValue(ok({ data: [], total: 0 } as any))
    const { result } = renderHook(() => useOrgs(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('empty'))
  })
})

describe('useSelectedOrg', () => {
  it('auto-selects the only org', async () => {
    // engine type/impl drift: see above
    vi.mocked(getMyMemberships).mockResolvedValue(
      ok({ data: [{ organizationId: 'o1', orgName: 'A' }], total: 1 } as any)
    )
    const { result } = renderHook(() => useSelectedOrg(), { wrapper })
    await waitFor(() => expect(result.current.orgId).toBe('o1'))
  })

  it('survives a throwing localStorage (private mode) without crashing', async () => {
    // Safari Private Mode can throw on getItem/setItem. The useState initializer
    // and the auto-select effect must not crash the hook.
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private mode') })
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private mode') })
    vi.mocked(getMyMemberships).mockResolvedValue(
      ok({ data: [{ organizationId: 'o1', orgName: 'A' }], total: 1 } as any)
    )
    const { result } = renderHook(() => useSelectedOrg(), { wrapper })
    // Initial read throws → falls back to null instead of crashing on load.
    expect(result.current.orgId).toBeNull()
    // Auto-select still updates in-memory state even though setItem throws (swallowed).
    await waitFor(() => expect(result.current.orgId).toBe('o1'))
    getSpy.mockRestore()
    setSpy.mockRestore()
  })

  it('persists an explicit selection', async () => {
    // engine type/impl drift: see above
    vi.mocked(getMyMemberships).mockResolvedValue(
      ok({ data: [{ organizationId: 'o1', orgName: 'A' }, { organizationId: 'o2', orgName: 'B' }], total: 2 } as any)
    )
    // F1: co-render useOrgs so we can wait for data to actually load before asserting no-auto-select.
    // The >1 guard must hold AFTER query resolves, not just at initial-null state.
    const { result } = renderHook(() => ({ orgs: useOrgs(), sel: useSelectedOrg() }), { wrapper })
    await waitFor(() => expect(result.current.orgs.status).toBe('ready'))
    expect(result.current.sel.orgId).toBeNull() // still null after data loaded — guard confirmed
    act(() => result.current.sel.setOrgId('o2'))
    expect(result.current.sel.orgId).toBe('o2')
    expect(localStorage.getItem('org.selectedOrgId')).toBe('o2')
  })
})

