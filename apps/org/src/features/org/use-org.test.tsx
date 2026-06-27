import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ getMyMemberships: vi.fn(), getMyOfficerRole: vi.fn() }))
import { getMyMemberships, getMyOfficerRole } from '@monobase/sdk-ts/generated'
import { useOrgs, useSelectedOrg, useIsOfficer } from './use-org'

// F4: QueryClient created inside useState so it's stable across re-renders (anti-pattern fix).
function wrapper({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => localStorage.clear())

describe('useOrgs', () => {
  it('dedupes memberships into distinct orgs', async () => {
    (getMyMemberships as any).mockResolvedValue({
      data: { data: [
        { organizationId: 'o1', orgName: 'Chapter A' },
        { organizationId: 'o1', orgName: 'Chapter A' },
        { organizationId: 'o2', orgName: 'Chapter B' },
      ], total: 3 }, response: new Response('', { status: 200 }),
    } as any)
    const { result } = renderHook(() => useOrgs(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.orgs).toEqual([{ id: 'o1', name: 'Chapter A' }, { id: 'o2', name: 'Chapter B' }])
  })

  it('empty when no memberships', async () => {
    (getMyMemberships as any).mockResolvedValue({ data: { data: [], total: 0 }, response: new Response('', { status: 200 }) } as any)
    const { result } = renderHook(() => useOrgs(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('empty'))
  })
})

describe('useSelectedOrg', () => {
  it('auto-selects the only org', async () => {
    (getMyMemberships as any).mockResolvedValue({ data: { data: [{ organizationId: 'o1', orgName: 'A' }], total: 1 }, response: new Response('', { status: 200 }) } as any)
    const { result } = renderHook(() => useSelectedOrg(), { wrapper })
    await waitFor(() => expect(result.current.orgId).toBe('o1'))
  })

  it('persists an explicit selection', async () => {
    (getMyMemberships as any).mockResolvedValue({ data: { data: [{ organizationId: 'o1', orgName: 'A' }, { organizationId: 'o2', orgName: 'B' }], total: 2 }, response: new Response('', { status: 200 }) } as any)
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

describe('useIsOfficer', () => {
  it('officer when terms array non-empty (real runtime shape)', async () => {
    ;(getMyOfficerRole as any).mockResolvedValue({ data: { data: [{ id: 'term1', status: 'active' }] }, response: new Response('', { status: 200 }) })
    const { result } = renderHook(() => useIsOfficer('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('officer'))
  })
  it('notOfficer when terms array empty (real runtime shape)', async () => {
    ;(getMyOfficerRole as any).mockResolvedValue({ data: { data: [] }, response: new Response('', { status: 200 }) })
    const { result } = renderHook(() => useIsOfficer('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('notOfficer'))
  })
  it('officer when object isOfficer:true (defensive/future typed shape)', async () => {
    ;(getMyOfficerRole as any).mockResolvedValue({ data: { data: { isOfficer: true, positions: [] } }, response: new Response('', { status: 200 }) })
    const { result } = renderHook(() => useIsOfficer('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('officer'))
  })
  // F6: cover object isOfficer:false branch — locks the safe-fail defensive path.
  it('notOfficer when object isOfficer:false (defensive path)', async () => {
    ;(getMyOfficerRole as any).mockResolvedValue({ data: { data: { isOfficer: false, positions: [] } }, response: new Response('', { status: 200 }) })
    const { result } = renderHook(() => useIsOfficer('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('notOfficer'))
  })
})
