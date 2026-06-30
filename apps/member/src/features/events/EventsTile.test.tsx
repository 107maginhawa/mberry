import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventsTile } from './EventsTile'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const rsvp = { mutate: vi.fn(), isPending: false, variables: undefined as { eventId: string } | undefined }
const pay = { mutate: vi.fn(), isPending: false, variables: undefined as { eventId: string } | undefined }
vi.mock('./use-rsvp', async (orig) => ({ ...(await orig<Record<string, unknown>>()), useRsvp: () => rsvp }))
vi.mock('./use-event-payment', () => ({ useRegisterAndPay: () => pay }))
vi.mock('./use-member-events', () => ({ useMemberEvents: vi.fn() }))
import { useMemberEvents } from './use-member-events'
const mockEvents = useMemberEvents as ReturnType<typeof vi.fn>

const future = new Date(Date.now() + 7 * 864e5).toISOString()
const freeEvent = { id: 'free', title: 'Annual Seminar', organizationId: 'org-1', eventType: 'seminar', startDate: future, endDate: future, registeredCount: 2, capacity: 10, status: 'published', registrationFee: 0n, currency: 'PHP' }
const paidEvent = { id: 'paid', title: 'Gala Dinner', organizationId: 'org-1', eventType: 'social', startDate: future, endDate: future, registeredCount: 0, status: 'published', registrationFee: 150000n, currency: 'PHP' }

describe('EventsTile', () => {
  beforeEach(() => { vi.clearAllMocks(); rsvp.isPending = false; rsvp.variables = undefined; pay.isPending = false; pay.variables = undefined })

  it('shows a free event with an RSVP button and no raw bigint', () => {
    mockEvents.mockReturnValue({ isLoading: false, isError: false, data: [freeEvent] })
    const { container } = render(<EventsTile />)
    expect(screen.getByText('Annual Seminar')).toBeInTheDocument()
    expect(screen.getByText('Free', { exact: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rsvp to annual seminar/i })).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/NaN|undefined|\d+n/)
  })

  it('shows a paid event with a Register & pay button (no RSVP) that starts payment', () => {
    mockEvents.mockReturnValue({ isLoading: false, isError: false, data: [paidEvent] })
    render(<EventsTile />)
    expect(screen.queryByRole('button', { name: /rsvp to gala dinner/i })).not.toBeInTheDocument()
    const btn = screen.getByRole('button', { name: /register and pay for gala dinner/i })
    expect(btn).toHaveTextContent(/₱1,500\.00/) // button shows the fee
    fireEvent.click(btn)
    expect(pay.mutate).toHaveBeenCalledWith({ eventId: 'paid' }, expect.anything())
  })

  it('loading → skeleton, error → error state, empty → empty state', () => {
    mockEvents.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    const { container, rerender } = render(<EventsTile />)
    expect(container.querySelector('.animate-pulse, [data-slot="skeleton"]')).toBeTruthy()
    mockEvents.mockReturnValue({ isLoading: false, isError: true, data: undefined })
    rerender(<EventsTile />)
    expect(screen.getByText(/couldn't load events/i)).toBeInTheDocument()
    mockEvents.mockReturnValue({ isLoading: false, isError: false, data: [] })
    rerender(<EventsTile />)
    expect(screen.getByText(/no upcoming events/i)).toBeInTheDocument()
  })
})
