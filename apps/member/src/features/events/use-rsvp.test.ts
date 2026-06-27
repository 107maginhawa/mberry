import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { ok, err } from '@/test-utils/mock-sdk'
import { useRsvp, isWaitlisted } from './use-rsvp'

vi.mock('@/features/org/use-member-org', () => ({ useMemberOrg: vi.fn(() => ({ orgId: 'org-1', memberships: [], select: vi.fn() })) }))
vi.mock('@monobase/sdk-ts/generated', () => ({ registerForCustomEvent: vi.fn() }))
import { registerForCustomEvent } from '@monobase/sdk-ts/generated'
const mockReg = registerForCustomEvent as unknown as ReturnType<typeof vi.fn>

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useRsvp', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts eventId as a path param (empty body); confirmed result is not waitlisted', async () => {
    // confirmed path → EventRegistration (real wired handler)
    mockReg.mockResolvedValue(ok({ id: 'r1', status: 'confirmed' }, 201))
    const { result } = renderHook(() => useRsvp(), { wrapper })
    result.current.mutate({ eventId: 'e1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockReg.mock.calls[0]![0]).toEqual({ path: { eventId: 'e1' } })
    expect(isWaitlisted(result.current.data!)).toBe(false)
  })

  it('detects a waitlisted result via the waitlisted flag (real shape has NO status)', async () => {
    // capacity-full path → { ...waitlistEntry, waitlisted: true }, NO status field
    mockReg.mockResolvedValue(ok({ id: 'w1', waitlisted: true }, 201))
    const { result } = renderHook(() => useRsvp(), { wrapper })
    result.current.mutate({ eventId: 'e1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(isWaitlisted(result.current.data!)).toBe(true)
  })

  it('throws a generic error on engine failure (a duplicate RSVP 500s — there is no 409)', async () => {
    mockReg.mockResolvedValue(err(500, { error: 'Internal Server Error' }))
    const { result } = renderHook(() => useRsvp(), { wrapper })
    result.current.mutate({ eventId: 'e1' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/could not rsvp|internal server error/i)
  })
})
