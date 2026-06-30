import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EventDetail } from './EventDetail'

const state = vi.hoisted(() => ({
  event: {} as any,
  attendees: [] as any[],
  summary: { total: 0, paid: 0, checkedIn: 0, noShow: 0 },
  total: 0,
  truncated: false,
  checkIn: vi.fn(),
  noShow: vi.fn(),
  markPaid: vi.fn(),
  serverSummary: undefined as any,
}))
const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@tanstack/react-router', () => ({ Link: ({ to: _t, children, ...p }: any) => <a {...p}>{children}</a> }))
vi.mock('../org/use-org', () => ({ useSelectedOrg: () => ({ orgId: 'o1' }) }))
vi.mock('sonner', () => ({ toast }))
vi.mock('./use-event-detail', () => ({
  useEvent: () => ({ event: state.event, isLoading: false, isError: false, refetch: vi.fn() }),
  useAttendees: () => ({ attendees: state.attendees, summary: state.summary, total: state.total, truncated: state.truncated, isLoading: false, isError: false, refetch: vi.fn() }),
  useEventSummary: () => ({ summary: state.serverSummary, isLoading: false, isError: false }),
  useCheckIn: () => ({ mutateAsync: state.checkIn }),
  useMarkNoShow: () => ({ mutateAsync: state.noShow }),
  useMarkPaid: () => ({ mutateAsync: state.markPaid }),
}))

const att = (o: Partial<any> = {}) => ({ registrationId: 'r1', personId: 'p1', label: 'Maria Santos', memberNumber: 'A-1', status: 'confirmed', paid: true, checkedIn: false, ...o })

beforeEach(() => {
  vi.clearAllMocks()
  state.event = { id: 'e1', title: 'Annual Assembly', startDate: '2026-03-14T02:00:00Z', status: 'published', registrationFee: 50000, location: 'Manila' }
  state.attendees = []
  state.summary = { total: 0, paid: 0, checkedIn: 0, noShow: 0 }
  state.total = 0
  state.truncated = false
  state.serverSummary = undefined
})

describe('EventDetail', () => {
  it('renders header + paid fee + count summary', () => {
    state.attendees = [att(), att({ registrationId: 'r2', personId: 'p2', label: 'Jose', paid: false })]
    state.summary = { total: 2, paid: 1, checkedIn: 0, noShow: 0 }
    render(<EventDetail eventId="e1" />)
    expect(screen.getByRole('heading', { name: 'Annual Assembly' })).toBeInTheDocument()
    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(screen.getByText('2 attending · 1 paid · 0 checked in')).toBeInTheDocument()
  })

  it('prefers server summary counts over the client tally when available', () => {
    state.attendees = [att(), att({ registrationId: 'r2', personId: 'p2', label: 'Jose', paid: false })]
    state.summary = { total: 2, paid: 1, checkedIn: 0, noShow: 0 } // client tally (capped/possibly stale)
    state.serverSummary = { total: 150, paid: 140, checkedIn: 120, noShow: 5 } // accurate server counts
    render(<EventDetail eventId="e1" />)
    expect(screen.getByText('150 attending · 140 paid · 120 checked in · 5 no-show')).toBeInTheDocument()
  })

  it('shows paid/unpaid badges for a paid event', () => {
    state.attendees = [att({ paid: true }), att({ registrationId: 'r2', personId: 'p2', label: 'Jose', paid: false })]
    render(<EventDetail eventId="e1" />)
    expect(screen.getByText('Paid')).toBeInTheDocument()
    expect(screen.getByText('Unpaid')).toBeInTheDocument()
  })

  it('omits paid badges for a free event', () => {
    state.event.registrationFee = 0
    state.attendees = [att({ paid: false })]
    render(<EventDetail eventId="e1" />)
    expect(screen.queryByText('Unpaid')).not.toBeInTheDocument()
    expect(screen.queryByText('Paid')).not.toBeInTheDocument()
  })

  it('a checked-in attendee shows the badge and no check-in button', () => {
    state.attendees = [att({ checkedIn: true })]
    render(<EventDetail eventId="e1" />)
    expect(screen.getByText('Checked in')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /check in/i })).not.toBeInTheDocument()
  })

  it('a failed check-in surfaces a retry, not a silent loss', async () => {
    state.attendees = [att({ checkedIn: false })]
    state.checkIn.mockRejectedValue(new Error('network down'))
    render(<EventDetail eventId="e1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /retry check-in/i })).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/failed/i)
    expect(toast.error).toHaveBeenCalledWith('network down')
  })

  it('surfaces a truncation banner when more attendees exist than are loaded', () => {
    state.attendees = [att()]
    state.total = 150
    state.truncated = true
    render(<EventDetail eventId="e1" />)
    expect(screen.getByText(/Showing the first 1 of 150 attendees/)).toBeInTheDocument()
  })

  it('a permission (403) error blocks the row with no retry loop', async () => {
    state.attendees = [att({ checkedIn: false })]
    state.checkIn.mockRejectedValue(new Error('You are not allowed to check members in.'))
    render(<EventDetail eventId="e1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }))
    await waitFor(() => expect(screen.getByText(/Treasurer or President/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /retry check-in/i })).not.toBeInTheDocument()
  })

  it('checks an attendee in', async () => {
    state.attendees = [att({ checkedIn: false })]
    state.checkIn.mockResolvedValue({})
    render(<EventDetail eventId="e1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }))
    await waitFor(() => expect(state.checkIn).toHaveBeenCalledWith({ personId: 'p1', registrationId: 'r1' }))
    expect(toast.success).toHaveBeenCalledWith('Checked in Maria Santos')
  })

  it('offers "Record cash payment" only for unpaid attendees on a paid event', () => {
    state.attendees = [att({ paid: false })]
    render(<EventDetail eventId="e1" />)
    expect(screen.getByRole('button', { name: /record cash payment/i })).toBeInTheDocument()
  })

  it('hides "Record cash payment" once paid and for a free event', () => {
    state.attendees = [att({ paid: true })]
    const { rerender } = render(<EventDetail eventId="e1" />)
    expect(screen.queryByRole('button', { name: /record cash payment/i })).not.toBeInTheDocument()
    state.event = { ...state.event, registrationFee: 0 }
    state.attendees = [att({ paid: false })]
    rerender(<EventDetail eventId="e1" />)
    expect(screen.queryByRole('button', { name: /record cash payment/i })).not.toBeInTheDocument()
  })

  it('records cash only after the confirm step (money guard)', async () => {
    state.attendees = [att({ paid: false })]
    state.markPaid.mockResolvedValue({})
    render(<EventDetail eventId="e1" />)
    fireEvent.click(screen.getByRole('button', { name: /record cash payment/i }))
    // Confirm dialog must appear with the amount — payment not yet sent.
    expect(state.markPaid).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }))
    await waitFor(() => expect(state.markPaid).toHaveBeenCalledWith({ registrationId: 'r1' }))
    expect(toast.success).toHaveBeenCalledWith('Recorded payment for Maria Santos')
  })
})
