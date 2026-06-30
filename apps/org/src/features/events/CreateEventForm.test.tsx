import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateEventForm } from './CreateEventForm'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../org/use-org', () => ({ useSelectedOrg: vi.fn(() => ({ orgId: 'org-1', setOrgId: vi.fn() })) }))
const mutate = vi.fn()
let state = { mutate, isPending: false, isError: false, error: null as Error | null }
vi.mock('./use-create-event', () => ({ useCreateEvent: () => state }))
import { useSelectedOrg } from '../org/use-org'

describe('CreateEventForm', () => {
  beforeEach(() => { vi.clearAllMocks(); state = { mutate, isPending: false, isError: false, error: null } })

  it('renders labeled fields and submits a typed input', async () => {
    render(<CreateEventForm />)
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'AGM' } })
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'assembly' } })
    fireEvent.change(screen.getByLabelText(/start/i), { target: { value: '2026-09-01T09:00' } })
    fireEvent.change(screen.getByLabelText(/end/i), { target: { value: '2026-09-01T13:00' } })
    fireEvent.click(screen.getByRole('button', { name: /create event/i }))
    await waitFor(() => expect(mutate).toHaveBeenCalled())
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const arg = mutate.mock.calls[0]![0]
    expect(arg.title).toBe('AGM')
    expect(typeof arg.startDate).toBe('string')
  })

  it('disables submit when no org selected', () => {
    ;(useSelectedOrg as ReturnType<typeof vi.fn>).mockReturnValueOnce({ orgId: null, setOrgId: vi.fn() })
    render(<CreateEventForm />)
    expect(screen.getByRole('button', { name: /create event/i })).toBeDisabled()
  })

  it('rejects endDate before startDate (client-side) without calling mutate', async () => {
    render(<CreateEventForm />)
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'AGM' } })
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'assembly' } })
    fireEvent.change(screen.getByLabelText(/start/i), { target: { value: '2026-09-01T13:00' } })
    fireEvent.change(screen.getByLabelText(/end/i), { target: { value: '2026-09-01T09:00' } })
    fireEvent.click(screen.getByRole('button', { name: /create event/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(mutate).not.toHaveBeenCalled()
  })

  it('rejects a start date in the past (client-side) without calling mutate', async () => {
    render(<CreateEventForm />)
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'AGM' } })
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'assembly' } })
    fireEvent.change(screen.getByLabelText(/start/i), { target: { value: '2020-01-01T10:00' } })
    fireEvent.change(screen.getByLabelText(/end/i), { target: { value: '2020-01-01T13:00' } })
    fireEvent.click(screen.getByRole('button', { name: /create event/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/in the past/i))
    expect(mutate).not.toHaveBeenCalled()
  })

  it('warns at the fee field when a paid fee is entered, and not when free', () => {
    render(<CreateEventForm />)
    expect(screen.queryByText(/Paid events need card setup/i)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/registration fee/i), { target: { value: '500' } })
    expect(screen.getByText(/Paid events need card setup/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/registration fee/i), { target: { value: '0' } })
    expect(screen.queryByText(/Paid events need card setup/i)).not.toBeInTheDocument()
  })

  it('shows a friendly alert on a 403 error', () => {
    state = { mutate, isPending: false, isError: true, error: new Error('Two-factor authentication required') }
    render(<CreateEventForm />)
    expect(screen.getByRole('alert')).toHaveTextContent(/two-factor/i)
  })
})
