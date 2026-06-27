import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ sendPaymentLink: vi.fn(), revokePaymentLink: vi.fn() }))
import { sendPaymentLink, revokePaymentLink } from '@monobase/sdk-ts/generated'
import type { SendPaymentLinkResponse, RevokePaymentLinkResponse } from '@monobase/sdk-ts/generated'
import { useSendLink } from './use-send-link'
import { ok, err } from '../../test-utils/mock-sdk'

beforeEach(() => vi.clearAllMocks())

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// Resolved type of the sendPaymentLink SDK call (success + error union).
// Used to type deferred-promise resolve callbacks to avoid `as any`.
type MintResult = Awaited<ReturnType<typeof sendPaymentLink>>

describe('useSendLink', () => {
  it('mint success → sent state, with amount coerced to bigint at the request boundary', async () => {
    vi.mocked(sendPaymentLink).mockResolvedValue(
      ok<SendPaymentLinkResponse>({ token: 'TOK', paymentUrl: '/pay/TOK', expiresAt: '2026-09-01T00:00:00Z' }, 201)
    )
    const { result } = renderHook(() => useSendLink('o1', 'p1'), { wrapper })
    act(() => result.current.mint({ amount: 250000, invoiceId: 'inv1' }))
    await waitFor(() => expect(result.current.state.kind).toBe('sent'))
    const s = result.current.state as Extract<typeof result.current.state, { kind: 'sent' }>
    expect(s.tokenId).toBe('TOK')
    expect(s.url).toMatch(/\/pay\/TOK$/)
    // amount MUST be bigint (SendPaymentLinkRequest.amount is bigint?) — a number would not typecheck.
    expect(sendPaymentLink).toHaveBeenCalledWith(expect.objectContaining({
      path: { organizationId: 'o1' },
      body: { personId: 'p1', amount: 250000n, invoiceId: 'inv1' },
    }))
  })

  it('mint 400 → error state with real server message (M-1)', async () => {
    // Cast err() to the SDK union type — error field type varies per endpoint
    vi.mocked(sendPaymentLink).mockResolvedValue(
      err(400, { error: 'Gateway not configured' }) as MintResult
    )
    const { result } = renderHook(() => useSendLink('o1', 'p1'), { wrapper })
    act(() => result.current.mint({ amount: 1000 }))
    await waitFor(() => expect(result.current.state.kind).toBe('error'))
    const s = result.current.state as Extract<typeof result.current.state, { kind: 'error' }>
    expect(s.message).toBe('Gateway not configured')
  })

  it('double-mint is guarded (one call while pending)', async () => {
    // Deferred promise — cast through unknown required because Promise<MintResult> ≠ Promise<exact-union>
    let resolve!: (v: MintResult | PromiseLike<MintResult>) => void
    vi.mocked(sendPaymentLink).mockReturnValue(
      new Promise<MintResult>((r) => { resolve = r }) as unknown as ReturnType<typeof sendPaymentLink>
    )
    const { result } = renderHook(() => useSendLink('o1', 'p1'), { wrapper })
    act(() => { result.current.mint({ amount: 1000 }); result.current.mint({ amount: 1000 }) })
    await waitFor(() => expect(result.current.state.kind).toBe('minting'))
    expect(sendPaymentLink).toHaveBeenCalledTimes(1)
    resolve(ok<SendPaymentLinkResponse>({ token: 'T', paymentUrl: '/pay/T', expiresAt: 'x' }, 201))
  })

  it('re-mint after revoke: minting then sent with new token (I-1)', async () => {
    // Deferred promise — cast through unknown required because Promise<MintResult> ≠ Promise<exact-union>
    let resolveSecond!: (v: MintResult | PromiseLike<MintResult>) => void
    const secondCallPromise = new Promise<MintResult>((r) => { resolveSecond = r }) as unknown as ReturnType<typeof sendPaymentLink>
    vi.mocked(sendPaymentLink)
      .mockResolvedValueOnce(ok<SendPaymentLinkResponse>({ token: 'TOK1', paymentUrl: '/pay/TOK1', expiresAt: 'x' }, 201))
      .mockReturnValueOnce(secondCallPromise)
    vi.mocked(revokePaymentLink).mockResolvedValue(ok<RevokePaymentLinkResponse>({ revoked: true }))
    const { result } = renderHook(() => useSendLink('o1', 'p1'), { wrapper })

    // First mint → sent
    act(() => result.current.mint({ amount: 1000 }))
    await waitFor(() => expect(result.current.state.kind).toBe('sent'))

    // Revoke → revoked
    act(() => result.current.revoke())
    await waitFor(() => expect(result.current.state.kind).toBe('revoked'))

    // Re-mint → state goes to minting (revokeM.isSuccess no longer wins precedence)
    act(() => result.current.mint({ amount: 2000 }))
    await waitFor(() => expect(result.current.state.kind).toBe('minting'))

    // Resolve second call → sent with TOK2
    resolveSecond(ok<SendPaymentLinkResponse>({ token: 'TOK2', paymentUrl: '/pay/TOK2', expiresAt: 'x' }, 201))
    await waitFor(() => expect(result.current.state.kind).toBe('sent'))
    const s = result.current.state as Extract<typeof result.current.state, { kind: 'sent' }>
    expect(s.tokenId).toBe('TOK2')
    expect(s.url).toMatch(/\/pay\/TOK2$/)
  })

  it('revoke success → revoked state', async () => {
    vi.mocked(sendPaymentLink).mockResolvedValue(
      ok<SendPaymentLinkResponse>({ token: 'T', paymentUrl: '/pay/T', expiresAt: 'x' }, 201)
    )
    vi.mocked(revokePaymentLink).mockResolvedValue(ok<RevokePaymentLinkResponse>({ revoked: true }))
    const { result } = renderHook(() => useSendLink('o1', 'p1'), { wrapper })
    act(() => result.current.mint({ amount: 1000 }))
    await waitFor(() => expect(result.current.state.kind).toBe('sent'))
    act(() => result.current.revoke())
    await waitFor(() => expect(result.current.state.kind).toBe('revoked'))
    expect(revokePaymentLink).toHaveBeenCalledWith(expect.objectContaining({ path: { organizationId: 'o1', tokenId: 'T' } }))
  })
})
