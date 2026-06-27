import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/features/auth/use-session', () => ({ useSession: vi.fn() }))
import { useSession } from '@/features/auth/use-session'
import { useMemberOrg } from './use-member-org'
import type { RawMembership } from '@/features/auth/use-session'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useMemberOrg [review I6]', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('orgId null while session pending (disabled→enabled transition: pending state)', () => {
    vi.mocked(useSession).mockReturnValue({ status: 'loading', memberships: undefined })
    const { result } = renderHook(() => useMemberOrg(), { wrapper })
    expect(result.current.orgId).toBeNull()
    expect(result.current.memberships).toEqual([])
  })

  it('orgId set when session resolves with a single membership (disabled→enabled: resolved)', () => {
    // Drift field: organizationId returned by handler; SDK MyMembership type may omit it.
    vi.mocked(useSession).mockReturnValue({
      status: 'authed',
      memberships: [{ organizationId: 'org-123' } as unknown as RawMembership],
    })
    const { result } = renderHook(() => useMemberOrg(), { wrapper })
    expect(result.current.orgId).toBe('org-123')
    expect(localStorage.getItem('member.selectedOrgId')).toBe('org-123')
  })

  it('returns stored orgId when already persisted', () => {
    localStorage.setItem('member.selectedOrgId', 'org-stored')
    vi.mocked(useSession).mockReturnValue({ status: 'authed', memberships: [] })
    const { result } = renderHook(() => useMemberOrg(), { wrapper })
    expect(result.current.orgId).toBe('org-stored')
  })

  it('select(id) persists into member.selectedOrgId', () => {
    vi.mocked(useSession).mockReturnValue({ status: 'authed', memberships: [] })
    const { result } = renderHook(() => useMemberOrg(), { wrapper })
    result.current.select('org-picked')
    expect(localStorage.getItem('member.selectedOrgId')).toBe('org-picked')
  })
})
