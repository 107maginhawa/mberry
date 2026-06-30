import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@monobase/sdk-ts/generated', () => ({
  getEvent: vi.fn(),
  listCustomEventRegistrations: vi.fn(),
  searchCheckIns: vi.fn(),
  checkInCustomEvent: vi.fn(),
  updateEventRegistration: vi.fn(),
  markEventRegistrationPaid: vi.fn(),
  getEventRegistrationsSummary: vi.fn(),
  listRosterMembers: vi.fn(),
}))
import {
  listCustomEventRegistrations, searchCheckIns, checkInCustomEvent, updateEventRegistration, markEventRegistrationPaid, getEventRegistrationsSummary, listRosterMembers,
} from '@monobase/sdk-ts/generated'
import { useAttendees, useCheckIn, useMarkNoShow, useMarkPaid, useEventSummary } from './use-event-detail'
import { ok } from '../../test-utils/mock-sdk'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => vi.clearAllMocks())

describe('useAttendees (registrations ⨝ check-ins ⨝ roster)', () => {
  it('joins names, derives paid + checkedIn, and tallies the summary', async () => {
    vi.mocked(listCustomEventRegistrations).mockResolvedValue(ok({ data: [
      { id: 'r1', personId: 'p1', status: 'confirmed', amountPaid: 50000, paymentId: 'pay1' }, // paid
      { id: 'r2', personId: 'p2', status: 'confirmed', amountPaid: 0, paymentId: null },        // unpaid, checked-in
      { id: 'r3', personId: 'p3', status: 'noShow' },                                           // no-show (real DB enum value)
      { id: 'r4', personId: 'p4', status: 'cancelled' },                                        // excluded from total
    ] } as any))
    vi.mocked(searchCheckIns).mockResolvedValue(ok({ data: [{ personId: 'p2', registrationId: 'r2' }] } as any))
    vi.mocked(listRosterMembers).mockResolvedValue(ok({ data: [
      { personId: 'p1', name: 'Maria Santos', memberNumber: 'A-1' },
      { personId: 'p2', firstName: 'Jose', lastName: 'Cruz' },
    ] } as any))

    const { result } = renderHook(() => useAttendees('o1', 'e1'), { wrapper })
    await waitFor(() => expect(result.current.attendees.length).toBe(4))

    // Engine caps these at 100 — a higher limit 400s the whole list.
    expect(vi.mocked(listCustomEventRegistrations)).toHaveBeenCalledWith({ path: { eventId: 'e1' }, query: { limit: 100 } })
    expect(vi.mocked(searchCheckIns)).toHaveBeenCalledWith({ query: { eventId: 'e1', limit: 100 } })

    const byId = Object.fromEntries(result.current.attendees.map((a) => [a.registrationId, a]))
    expect(byId.r1).toMatchObject({ label: 'Maria Santos', paid: true, checkedIn: false })
    expect(byId.r2).toMatchObject({ label: 'Jose Cruz', paid: false, checkedIn: true })
    expect(byId.r3!.label).toMatch(/Member p3/) // non-roster fallback label
    expect(result.current.summary).toEqual({ total: 3, paid: 1, checkedIn: 1, noShow: 1 })
  })
})

describe('useEventSummary (server-side counts)', () => {
  it('maps totalAttending->total and coerces counts to numbers', async () => {
    vi.mocked(getEventRegistrationsSummary).mockResolvedValue(ok({ totalAttending: 150, paid: 140, checkedIn: 120, noShow: 5 }) as any)
    const { result } = renderHook(() => useEventSummary('o1', 'e1'), { wrapper })
    await waitFor(() => expect(result.current.summary).toBeDefined())
    expect(vi.mocked(getEventRegistrationsSummary)).toHaveBeenCalledWith({ path: { eventId: 'e1' } })
    expect(result.current.summary).toEqual({ total: 150, paid: 140, checkedIn: 120, noShow: 5 })
  })
})

describe('check-in / no-show payloads', () => {
  it('checkInCustomEvent gets eventId path + person/registration body', async () => {
    vi.mocked(checkInCustomEvent).mockResolvedValue(ok({ id: 'c1' }) as any)
    const { result } = renderHook(() => useCheckIn('e1'), { wrapper })
    await result.current.mutateAsync({ personId: 'p1', registrationId: 'r1' })
    expect(vi.mocked(checkInCustomEvent)).toHaveBeenCalledWith({
      path: { eventId: 'e1' },
      body: { personId: 'p1', registrationId: 'r1', method: 'manual' },
    })
  })

  it('updateEventRegistration marks noShow (real DB enum) by registrationId', async () => {
    vi.mocked(updateEventRegistration).mockResolvedValue(ok({ id: 'r1', status: 'noShow' }) as any)
    const { result } = renderHook(() => useMarkNoShow('e1'), { wrapper })
    await result.current.mutateAsync({ registrationId: 'r1' })
    expect(vi.mocked(updateEventRegistration)).toHaveBeenCalledWith({
      path: { registrationId: 'r1' },
      body: { status: 'noShow' },
    })
  })

  it('markEventRegistrationPaid posts by registrationId (walk-up cash)', async () => {
    vi.mocked(markEventRegistrationPaid).mockResolvedValue(ok({ id: 'r1', paidAt: '2030-03-14T01:00:00Z' }) as any)
    const { result } = renderHook(() => useMarkPaid('e1'), { wrapper })
    await result.current.mutateAsync({ registrationId: 'r1' })
    expect(vi.mocked(markEventRegistrationPaid)).toHaveBeenCalledWith({ path: { registrationId: 'r1' } })
  })

  it('useMarkPaid surfaces a friendly 403 (officer-only)', async () => {
    vi.mocked(markEventRegistrationPaid).mockResolvedValue({ data: undefined, error: undefined, response: { status: 403 } } as any)
    const { result } = renderHook(() => useMarkPaid('e1'), { wrapper })
    await expect(result.current.mutateAsync({ registrationId: 'r1' })).rejects.toThrow(/not allowed/i)
  })
})
