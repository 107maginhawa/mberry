/**
 * TDD (RED first): tests for usePayNow hook.
 * Written before use-pay-now.ts exists — expect import failure → RED.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// ─── SDK mock (hoisted before imports) ────────────────────────────────────────

vi.mock('@monobase/sdk-ts/generated', () => ({
  mintMyPaymentLink: vi.fn(),
}))

vi.mock('@/features/org/use-member-org', () => ({
  useMemberOrg: vi.fn(() => ({ orgId: 'org-1' })),
}))

import { mintMyPaymentLink } from '@monobase/sdk-ts/generated'
import type { SendPaymentLinkResponse } from '@monobase/sdk-ts/generated'
import { ok, err } from '@/test-utils/mock-sdk'
import { usePayNow } from './use-pay-now'

// ─── Wrapper ──────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

// Re-import useMemberOrg after vi.mock so we can restore the default after clearAllMocks
import { useMemberOrg } from '@/features/org/use-member-org'

beforeEach(() => {
  vi.clearAllMocks()
  // Restore default orgId after clearAllMocks wipes the implementation
  vi.mocked(useMemberOrg).mockReturnValue({ orgId: 'org-1', memberships: [], select: vi.fn() })
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('usePayNow', () => {
  it('calls mintMyPaymentLink with correct path + body and returns SendPaymentLinkResponse', async () => {
    const response: SendPaymentLinkResponse = {
      token: 'tok-abc',
      paymentUrl: '/pay/tok-abc',
      expiresAt: '2026-07-01T00:00:00.000Z',
    }
    vi.mocked(mintMyPaymentLink).mockResolvedValue(ok<SendPaymentLinkResponse>(response, 201))

    const { result } = renderHook(() => usePayNow(), { wrapper })

    await act(async () => {
      result.current.mutate({ invoiceId: 'inv-1' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mintMyPaymentLink).toHaveBeenCalledWith({
      path: { organizationId: 'org-1' },
      body: { invoiceId: 'inv-1' },
    })
    expect(result.current.data).toEqual(response)
  })

  it('throws when orgId is null', async () => {
    vi.mocked(useMemberOrg).mockReturnValue({ orgId: null, memberships: [], select: vi.fn() })

    const { result } = renderHook(() => usePayNow(), { wrapper })

    await act(async () => {
      result.current.mutate({ invoiceId: 'inv-1' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/no organization/i)
  })

  it('throws with serverError message on API error (e.g. 403)', async () => {
    // err() returns error:unknown; cast to any because hey-api error types are narrow
    vi.mocked(mintMyPaymentLink).mockResolvedValue(
      err(403, { error: 'Forbidden — not your invoice.' }) as any,
    )

    const { result } = renderHook(() => usePayNow(), { wrapper })

    await act(async () => {
      result.current.mutate({ invoiceId: 'inv-1' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toContain('Forbidden — not your invoice.')
  })
})
