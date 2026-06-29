import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateAnnouncementForm } from './CreateAnnouncementForm'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../org/use-org', () => ({ useSelectedOrg: vi.fn(() => ({ orgId: 'org-1', setOrgId: vi.fn() })) }))
const mutate = vi.fn()
let state = { mutate, isPending: false, isError: false, error: null as Error | null }
vi.mock('./use-create-announcement', () => ({ useCreateAnnouncement: () => state }))

describe('CreateAnnouncementForm', () => {
  beforeEach(() => { vi.clearAllMocks(); state = { mutate, isPending: false, isError: false, error: null } })

  it('shows the 2FA note and submits title+content', async () => {
    render(<CreateAnnouncementForm />)
    expect(screen.getByText(/two-factor/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Hi' } })
    fireEvent.change(screen.getByLabelText(/content|message/i), { target: { value: 'Body' } })
    fireEvent.click(screen.getByRole('button', { name: /post announcement/i }))
    await waitFor(() => expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Hi', content: 'Body' }),
      expect.anything(),
    ))
  })

  it('does not submit whitespace-only title/content (trimmed guard)', () => {
    render(<CreateAnnouncementForm />)
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText(/content|message/i), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /post announcement/i }))
    expect(mutate).not.toHaveBeenCalled()
  })

  it('trims surrounding whitespace before submitting', async () => {
    render(<CreateAnnouncementForm />)
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: '  Hi  ' } })
    fireEvent.change(screen.getByLabelText(/content|message/i), { target: { value: '  Body  ' } })
    fireEvent.click(screen.getByRole('button', { name: /post announcement/i }))
    await waitFor(() => expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Hi', content: 'Body' }),
      expect.anything(),
    ))
  })

  it('surfaces a 403 as a friendly alert', () => {
    state = { mutate, isPending: false, isError: true, error: new Error('Two-factor authentication required') }
    render(<CreateAnnouncementForm />)
    expect(screen.getByRole('alert')).toHaveTextContent(/two-factor/i)
  })
})
