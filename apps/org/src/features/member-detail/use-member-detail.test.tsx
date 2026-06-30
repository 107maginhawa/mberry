import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@monobase/sdk-ts/generated', () => ({
  getRosterMember: vi.fn(),
  listDuesPayments: vi.fn(),
  listDuesInvoices: vi.fn(),
  recordDuesPayment: vi.fn(),
  refundDuesPayment: vi.fn(),
  renewMembership: vi.fn(),
  searchEventRegistrations: vi.fn(),
  getEvent: vi.fn(),
}))
import { recordDuesPayment, refundDuesPayment, renewMembership, searchEventRegistrations, getEvent } from '@monobase/sdk-ts/generated'
import { useRecordPayment, useRefundPayment, useRenewMembership, useMemberEventPayments, canVoid, type MemberPayment } from './use-member-detail'
import { ok, err } from '../../test-utils/mock-sdk'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const pay = (o: Partial<MemberPayment>): MemberPayment => ({
  id: 'p', amount: 150000, currency: 'PHP', paymentMethod: 'cash', status: 'completed',
  refundedAmount: 0, paidAt: new Date().toISOString(), ...o,
})

beforeEach(() => vi.clearAllMocks())

describe('useMemberEventPayments (paid event registrations)', () => {
  it('keeps only settled non-terminal regs in this org; joins event title + fee', async () => {
    vi.mocked(searchEventRegistrations).mockResolvedValue(ok({ data: [
      { id: 'r1', eventId: 'e1', organizationId: 'o1', status: 'confirmed', paidAt: '2030-03-14T01:00:00Z' }, // kept
      { id: 'r2', eventId: 'e2', organizationId: 'o1', status: 'confirmed', paidAt: null },                   // unpaid — dropped
      { id: 'r3', eventId: 'e3', organizationId: 'o1', status: 'refunded', paidAt: '2030-03-14T01:00:00Z' },  // refunded — dropped
      { id: 'r4', eventId: 'e4', organizationId: 'o2', status: 'confirmed', paidAt: '2030-03-14T01:00:00Z' }, // other org — dropped (no cross-org leak)
    ] } as any))
    vi.mocked(getEvent).mockImplementation(((opts: any) =>
      Promise.resolve(ok({ id: opts.path.eventId, title: 'Annual Gala', registrationFee: 150000 as any, currency: 'PHP' }))) as any)

    const { result } = renderHook(() => useMemberEventPayments('person-1', 'o1'), { wrapper })
    await waitFor(() => expect(result.current.eventPayments[0]?.eventTitle).toBe('Annual Gala'))

    expect(vi.mocked(searchEventRegistrations)).toHaveBeenCalledWith({ query: { personId: 'person-1', limit: 50 } })
    expect(result.current.eventPayments).toHaveLength(1)
    expect(result.current.eventPayments[0]).toMatchObject({
      id: 'r1', eventTitle: 'Annual Gala', amount: 150000, currency: 'PHP', paidAt: '2030-03-14T01:00:00Z',
    })
    // The other-org event is never even fetched.
    expect(vi.mocked(getEvent)).not.toHaveBeenCalledWith({ path: { eventId: 'e4' } })
  })

  it('suppresses the amount (null, not ₱0) when the event lookup fails', async () => {
    vi.mocked(searchEventRegistrations).mockResolvedValue(ok({ data: [
      { id: 'r1', eventId: 'e1', organizationId: 'o1', status: 'confirmed', paidAt: '2030-03-14T01:00:00Z' },
    ] } as any))
    vi.mocked(getEvent).mockResolvedValue({ data: undefined, error: undefined, response: { status: 404 } } as any)

    const { result } = renderHook(() => useMemberEventPayments('person-1', 'o1'), { wrapper })
    await waitFor(() => expect(result.current.eventPayments).toHaveLength(1))
    expect(result.current.eventPayments[0]).toMatchObject({ id: 'r1', eventTitle: 'Event', amount: null })
  })

  it('returns no event payments for a member with none (graceful)', async () => {
    vi.mocked(searchEventRegistrations).mockResolvedValue(ok({ data: [] } as any))
    const { result } = renderHook(() => useMemberEventPayments('person-2', 'o1'), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.eventPayments).toEqual([])
    expect(vi.mocked(getEvent)).not.toHaveBeenCalled()
  })
})

describe('canVoid', () => {
  it('allows voiding a completed payment ≤30 days old', () => {
    expect(canVoid(pay({ status: 'completed', paidAt: new Date().toISOString() }))).toBe(true)
  })
  it('blocks a completed payment older than 30 days', () => {
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString()
    expect(canVoid(pay({ status: 'completed', paidAt: old }))).toBe(false)
  })
  it('blocks a non-completed (already refunded) payment', () => {
    expect(canVoid(pay({ status: 'refunded' }))).toBe(false)
  })
})

describe('useRecordPayment', () => {
  it('sends centavos amount + org + person to recordDuesPayment', async () => {
    vi.mocked(recordDuesPayment).mockResolvedValue(ok({ id: 'pay1' }) as any)
    const { result } = renderHook(() => useRecordPayment('o1', 'per1'), { wrapper })
    await result.current.mutateAsync({ amount: 250000, currency: 'PHP', paymentMethod: 'gcash', referenceNumber: 'GC-9' })
    expect(vi.mocked(recordDuesPayment)).toHaveBeenCalledWith({
      body: { organizationId: 'o1', personId: 'per1', amount: 250000, currency: 'PHP', paymentMethod: 'gcash', referenceNumber: 'GC-9' },
    })
  })

  it('maps a 403 to a friendly role message', async () => {
    vi.mocked(recordDuesPayment).mockResolvedValue(err(403, { error: 'forbidden' }) as any)
    const { result } = renderHook(() => useRecordPayment('o1', 'per1'), { wrapper })
    await expect(
      result.current.mutateAsync({ amount: 1000, currency: 'PHP', paymentMethod: 'cash' }),
    ).rejects.toThrow(/Treasurer or President/i)
  })
})

describe('useRefundPayment / useRenewMembership', () => {
  it('voids by paymentId', async () => {
    vi.mocked(refundDuesPayment).mockResolvedValue(ok({ id: 'pay1', status: 'refunded' }) as any)
    const { result } = renderHook(() => useRefundPayment(), { wrapper })
    await result.current.mutateAsync({ paymentId: 'pay1' })
    expect(vi.mocked(refundDuesPayment)).toHaveBeenCalledWith({ path: { paymentId: 'pay1' }, body: {} })
  })

  it('renews by membershipId', async () => {
    vi.mocked(renewMembership).mockResolvedValue(ok({ id: 'm1' }) as any)
    const { result } = renderHook(() => useRenewMembership(), { wrapper })
    await result.current.mutateAsync({ membershipId: 'm1' })
    expect(vi.mocked(renewMembership)).toHaveBeenCalledWith({ path: { membershipId: 'm1' } })
  })

  it('refund 403 → friendly message', async () => {
    vi.mocked(refundDuesPayment).mockResolvedValue(err(403, { error: 'forbidden' }) as any)
    const { result } = renderHook(() => useRefundPayment(), { wrapper })
    await expect(result.current.mutateAsync({ paymentId: 'p1' })).rejects.toThrow(/Treasurer or President/i)
  })
})
