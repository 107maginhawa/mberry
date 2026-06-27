import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ sendPaymentLink: vi.fn(), revokePaymentLink: vi.fn() }))
import { sendPaymentLink, revokePaymentLink } from '@monobase/sdk-ts/generated'
import { useSendLink } from './use-send-link'

beforeEach(() => vi.clearAllMocks())

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSendLink', () => {
  it('mint success → sent state, with amount coerced to bigint at the request boundary', async () => {
    ;(sendPaymentLink as any).mockResolvedValue({
      data: { token: 'TOK', paymentUrl: '/pay/TOK', expiresAt: '2026-09-01T00:00:00Z' },
      response: new Response('', { status: 201 }),
    })
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

  it('mint 400 → error state', async () => {
    ;(sendPaymentLink as any).mockResolvedValue({ data: undefined, response: new Response(JSON.stringify({ error: 'Gateway not configured' }), { status: 400 }) })
    const { result } = renderHook(() => useSendLink('o1', 'p1'), { wrapper })
    act(() => result.current.mint({ amount: 1000 }))
    await waitFor(() => expect(result.current.state.kind).toBe('error'))
  })

  it('double-mint is guarded (one call while pending)', async () => {
    let resolve!: (v: unknown) => void
    ;(sendPaymentLink as any).mockReturnValue(new Promise((r) => { resolve = r }))
    const { result } = renderHook(() => useSendLink('o1', 'p1'), { wrapper })
    act(() => { result.current.mint({ amount: 1000 }); result.current.mint({ amount: 1000 }) })
    await waitFor(() => expect(result.current.state.kind).toBe('minting'))
    expect(sendPaymentLink).toHaveBeenCalledTimes(1)
    resolve({ data: { token: 'T', paymentUrl: '/pay/T', expiresAt: 'x' }, response: new Response('', { status: 201 }) })
  })

  it('revoke success → revoked state', async () => {
    ;(sendPaymentLink as any).mockResolvedValue({ data: { token: 'T', paymentUrl: '/pay/T', expiresAt: 'x' }, response: new Response('', { status: 201 }) })
    ;(revokePaymentLink as any).mockResolvedValue({ data: { revoked: true }, response: new Response('', { status: 200 }) })
    const { result } = renderHook(() => useSendLink('o1', 'p1'), { wrapper })
    act(() => result.current.mint({ amount: 1000 }))
    await waitFor(() => expect(result.current.state.kind).toBe('sent'))
    act(() => result.current.revoke())
    await waitFor(() => expect(result.current.state.kind).toBe('revoked'))
    expect(revokePaymentLink).toHaveBeenCalledWith(expect.objectContaining({ path: { organizationId: 'o1', tokenId: 'T' } }))
  })
})
