import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBulkSend } from './use-bulk-send'

vi.mock('@monobase/sdk-ts/generated', () => ({
  listDuesInvoices: vi.fn(),
  sendPaymentLink: vi.fn(),
}))
import { listDuesInvoices, sendPaymentLink } from '@monobase/sdk-ts/generated'

const ok201 = (paymentUrl: string) => ({
  data: { paymentUrl, token: 't', expiresAt: '2026-07-01T00:00:00Z' },
  error: undefined,
  response: { status: 201 } as Response,
})

beforeEach(() => {
  vi.clearAllMocks()
  // @ts-expect-error jsdom origin
  delete window.location
  // @ts-expect-error minimal stub
  window.location = { origin: 'https://app.test' }
})

describe('useBulkSend', () => {
  it('picks the oldest-periodStart outstanding invoice and mints once per member', async () => {
    ;(listDuesInvoices as any).mockResolvedValue({
      data: {
        data: [
          { id: 'newer', status: 'generated', periodStart: '2026-03-01', createdAt: '2026-03-01', totalAmount: 200n },
          { id: 'older', status: 'overdue', periodStart: '2026-01-01', createdAt: '2026-01-01', totalAmount: 500n },
          { id: 'paid', status: 'paid', periodStart: '2025-01-01', createdAt: '2025-01-01', totalAmount: 999n },
        ],
      },
    })
    ;(sendPaymentLink as any).mockResolvedValue(ok201('/pay/abc'))

    const members = [{ membershipId: 'm1', personId: 'p1', name: 'Olive' }]
    const { result } = renderHook(() => useBulkSend('org1', members))
    await act(async () => { await result.current.start() })

    await waitFor(() => expect(result.current.results['m1']!.status).toBe('sent'))
    expect(sendPaymentLink).toHaveBeenCalledTimes(1)
    expect(sendPaymentLink).toHaveBeenCalledWith({
      path: { organizationId: 'org1' },
      body: { personId: 'p1', amount: 500, invoiceId: 'older' },
    })
    expect(result.current.results['m1']).toEqual({ status: 'sent', url: 'https://app.test/pay/abc' })
    expect(result.current.progress).toEqual({ done: 1, total: 1 })
  })

  it('skips members with no outstanding invoice (no-dues), never mints for them', async () => {
    ;(listDuesInvoices as any).mockResolvedValue({ data: { data: [{ id: 'p', status: 'paid', periodStart: '2026-01-01', totalAmount: 1n }] } })
    const members = [{ membershipId: 'm1', personId: 'p1', name: 'Ben' }]
    const { result } = renderHook(() => useBulkSend('org1', members))
    await act(async () => { await result.current.start() })
    await waitFor(() => expect(result.current.results['m1']!.status).toBe('no-dues'))
    expect(sendPaymentLink).not.toHaveBeenCalled()
  })

  it('records an error on non-201 and keeps going to the next member', async () => {
    ;(listDuesInvoices as any).mockResolvedValue({ data: { data: [{ id: 'i1', status: 'generated', periodStart: '2026-01-01', totalAmount: 100n }] } })
    ;(sendPaymentLink as any)
      .mockResolvedValueOnce({ data: undefined, error: { error: 'nope' }, response: { status: 403 } as Response })
      .mockResolvedValueOnce(ok201('/pay/two'))
    const members = [
      { membershipId: 'm1', personId: 'p1', name: 'A' },
      { membershipId: 'm2', personId: 'p2', name: 'B' },
    ]
    const { result } = renderHook(() => useBulkSend('org1', members))
    await act(async () => { await result.current.start() })
    await waitFor(() => expect(result.current.progress.done).toBe(2))
    expect(result.current.results['m1']!.status).toBe('error')
    expect(result.current.results['m2']!.status).toBe('sent')
  })

  it('marks a failed invoice lookup as error, not no-dues, and never mints', async () => {
    ;(listDuesInvoices as any).mockResolvedValue({ data: undefined, error: { error: 'nope' }, response: { status: 403 } as Response })
    const members = [{ membershipId: 'm1', personId: 'p1', name: 'A' }]
    const { result } = renderHook(() => useBulkSend('org1', members))
    await act(async () => { await result.current.start() })
    await waitFor(() => expect(result.current.results['m1']!.status).toBe('error'))
    expect(sendPaymentLink).not.toHaveBeenCalled()
  })

  it('reset() allows a fresh send to mint again', async () => {
    ;(listDuesInvoices as any).mockResolvedValue({ data: { data: [{ id: 'i1', status: 'generated', periodStart: '2026-01-01', totalAmount: 100n }] } })
    ;(sendPaymentLink as any).mockResolvedValue(ok201('/pay/x'))
    const members = [{ membershipId: 'm1', personId: 'p1', name: 'A' }]
    const { result } = renderHook(() => useBulkSend('org1', members))
    await act(async () => { await result.current.start() })
    expect(sendPaymentLink).toHaveBeenCalledTimes(1)
    act(() => result.current.reset())
    await waitFor(() => expect(result.current.progress.done).toBe(0))
    await act(async () => { await result.current.start() })
    expect(sendPaymentLink).toHaveBeenCalledTimes(2)
  })

  it('start() is idempotent — a second call does not double-mint', async () => {
    ;(listDuesInvoices as any).mockResolvedValue({ data: { data: [{ id: 'i1', status: 'generated', periodStart: '2026-01-01', totalAmount: 100n }] } })
    ;(sendPaymentLink as any).mockResolvedValue(ok201('/pay/x'))
    const members = [{ membershipId: 'm1', personId: 'p1', name: 'A' }]
    const { result } = renderHook(() => useBulkSend('org1', members))
    await act(async () => { const p = result.current.start(); result.current.start(); await p })
    await waitFor(() => expect(result.current.progress.done).toBe(1))
    expect(sendPaymentLink).toHaveBeenCalledTimes(1)
  })
})
