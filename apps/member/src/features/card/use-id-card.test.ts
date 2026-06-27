import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useIdCard, type IdCardData } from './use-id-card'

vi.mock('@/features/org/use-member-org', () => ({
  useMemberOrg: vi.fn(() => ({ orgId: 'org-1', memberships: [], select: vi.fn() })),
}))
import { useMemberOrg } from '@/features/org/use-member-org'

const CARD: IdCardData = {
  personId: 'p1', firstName: 'Olive', lastName: 'Reyes', licenseNumber: 'DEN-12345',
  organizationName: 'Manila Dental Chapter', membershipStatus: 'active', photoUrl: null,
  qrPayload: 'eyJ2IjoxfQ==', qrSignature: 'abc123', validUntil: '2027-01-01',
  verifyCredentialNumber: 'MC-0001',
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useIdCard', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('fetches and maps the id-card to IdCardData', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ data: CARD }), { status: 200 }),
    )
    const { result } = renderHook(() => useIdCard(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(CARD)
    const url = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
    expect(url).toContain('/api/persons/me/id-card/org-1')
  })

  it('throws on non-ok (>=500) response', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('', { status: 500 }))
    const { result } = renderHook(() => useIdCard(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('resolves null on 404 (no card yet → empty state)', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('', { status: 404 }))
    const { result } = renderHook(() => useIdCard(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('is disabled when no orgId', async () => {
    ;(useMemberOrg as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({ orgId: null, memberships: [], select: vi.fn() })
    const { result } = renderHook(() => useIdCard(), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
